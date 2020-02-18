import puppeteer from 'puppeteer'
import express from 'express'
import { Server } from 'http'
import { getType, getProjectsSourceDir, readFileContents, getEntryIdFromFilePath } from '../utils'
import { prepareAndExtract } from './evaluate'

// `import projects from 'docere-projects'` does not work because setting type: "module" in package.json
// of docere-projects makes `npm run bundle` fail with ERR_REQUIRE_ESM
const projects = require('esm')(module)('docere-projects').default

const port = 3334

export default class Puppenv {
	private browser: puppeteer.Browser
	private server: Server
	private pages: Map<string, puppeteer.Page> = new Map()
	private configDatas: Map<string, DocereConfigData> = new Map()

	constructor() {
		const app = express()
		app.disable('x-powered-by')
		app.use(express.static(getProjectsSourceDir().replace(/^\/app/, '').replace(/src$/, '')))
		app.use(express.static(process.cwd()))

		// app.use(express.static(path.resolve(process.cwd(), `node_modules/docere-projects/src`)))
		app.get('/', (_req, res) => res.send(`<html><head></head><body><canvas></canvas></body></html>`))
		this.server = app.listen(port, () => console.log('Running express server for Puppeteer pages'))
	}

	async start() {
		this.browser = await puppeteer.launch({
			args: [
				'--no-sandbox',
				// '--disable-setuid-sandbox',
			]
		})

		console.log('Puppeteer launched')
	}

	async close() {
		await this.browser.close()
		this.server.close()
	}

	async getDocumentFields(xml: string, projectId: string, documentId?: string): Promise<ElasticSearchDocument> {
		const page = await this.getPage(projectId)

		let result: any
		try {
			result = await page.evaluate(
				prepareAndExtract,
				xml,
				documentId,
				projectId,
			)
		} catch (err) {
			console.log('er', err)	
		}

		if (result.hasOwnProperty('__error')) throw new Error(result.__error)

		return result as ElasticSearchDocument
	}

	async getMapping(projectId: string, filePaths: string[]): Promise<Mapping> {
		const properties: MappingProperties = {}
		const docereConfigData = await this.getConfigData(projectId)
		if (docereConfigData == null) throw new Error(`No config found for project '${projectId}'`)

		const selectedFileNames = [
			filePaths[0],
			filePaths[Math.floor(filePaths.length * .125)],
			filePaths[Math.floor(filePaths.length * .25)],
			filePaths[Math.floor(filePaths.length * .375)],
			filePaths[Math.floor(filePaths.length * .5)],
			filePaths[Math.floor(filePaths.length * .625)],
			filePaths[Math.floor(filePaths.length * .75)],
			filePaths[Math.floor(filePaths.length * .875)],
			filePaths[filePaths.length - 1]
		]	

		const xmlContents = await Promise.all(selectedFileNames.map(fn => readFileContents(fn)))

		const fieldKeys = new Set<string>()
		for (const [i, xml] of xmlContents.entries()) {
			const entryId = getEntryIdFromFilePath(selectedFileNames[i], projectId)
			const fields = await this.getDocumentFields(xml, projectId, entryId)
			Object.keys(fields).forEach(fieldKey => fieldKeys.add(fieldKey))
		}

		if (docereConfigData.config.hasOwnProperty('metadata')) docereConfigData.config.metadata.forEach(md => fieldKeys.add(md.id))
		if (docereConfigData.config.hasOwnProperty('textData')) docereConfigData.config.textData.forEach(td => fieldKeys.add(td.id))

		fieldKeys
			.forEach(key => {
				const type = getType(key, docereConfigData.config)
				if (type != null) properties[key] = { type }
			})

		properties.text_suggest = {
			type: EsDataType.Completion,
			analyzer: "simple",
			preserve_separators: true,
			preserve_position_increments: true,
			max_input_length: 50,
		}

		return {
			mappings: { properties }
		}
	}

	async getConfigData(projectId: string) {
		if (this.configDatas.has(projectId)) {
			return this.configDatas.get(projectId)
		}
		let configData: DocereConfigData
		try {
			const configDataImport = await projects[projectId]
			configData = (await configDataImport()).default
		} catch (err) {
			console.log(err)
			throw new Error(`[getConfigData] Config data not found for '${projectId}'`)
		}

		this.configDatas.set(projectId, configData)
		console.log(`Return ${projectId} config`)
		return configData
	}

	private async getPage(projectId: string) {
		if (this.pages.has(projectId)) return this.pages.get(projectId)

		const page = await this.browser.newPage()
		page.on('console', (msg: any) => {
			msg = msg.text()
			console.log('From page: ', msg)
		})
		await page.goto(`http://localhost:${port}`)

		await page.addScriptTag({ path: './node_modules/docere-projects/bundle/index.js' })

		this.pages.set(projectId, page)	
		console.log(`Return ${projectId} page`)
		return page
	}
}
