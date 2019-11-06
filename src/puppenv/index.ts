import puppeteer from 'puppeteer'
import express from 'express'
import { Server } from 'http'
import { getType, getConfigDataPath, getProjectsDir, readFileContents, xmlBasename } from '../utils'
import { prepareAndExtract } from './evaluate'

export default class Puppenv {
	private browser: puppeteer.Browser
	private server: Server
	private pages: Map<string, puppeteer.Page> = new Map()
	private configDatas: Map<string, DocereConfigData> = new Map()

	constructor() {
		const app = express()
		app.disable('x-powered-by')
		app.use(express.static(getProjectsDir().replace(/^\/app/, '')))
		app.get('/', (_req, res) => res.send(`<html><head></head><body><canvas></canvas></body></html>`))
		this.server = app.listen(3333, () => console.log('Running express server for Puppeteer pages'))
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
		const docereConfigData = await this.getConfigData(projectId)
		if (docereConfigData == null) throw new Error(`No config found for project '${projectId}'`)

		const page = await this.getPage(projectId, docereConfigData)

		const result = await page.evaluate(
			prepareAndExtract,
			xml,
			documentId,
			docereConfigData.config as any,
		)

		if (result.hasOwnProperty('__error')) throw new Error(result.__error)

		return result as ElasticSearchDocument
	}

	async getMapping(projectId: string, fileNames: string[]): Promise<Mapping> {
		const properties: MappingProperties = {}
		const docereConfigData = await this.getConfigData(projectId)
		if (docereConfigData == null) throw new Error(`No config found for project '${projectId}'`)

		const selectedFileNames = [
			fileNames[0],
			fileNames[Math.floor(fileNames.length * .125)],
			fileNames[Math.floor(fileNames.length * .25)],
			fileNames[Math.floor(fileNames.length * .375)],
			fileNames[Math.floor(fileNames.length * .5)],
			fileNames[Math.floor(fileNames.length * .625)],
			fileNames[Math.floor(fileNames.length * .75)],
			fileNames[Math.floor(fileNames.length * .875)],
			fileNames[fileNames.length - 1]
		]	

		const xmlContents = await Promise.all(selectedFileNames.map(fn => readFileContents(projectId, fn)))

		const fieldKeys = new Set<string>()
		for (const [i, xml] of xmlContents.entries()) {
			const fields = await this.getDocumentFields(xml, projectId, xmlBasename(selectedFileNames[i]))
			Object.keys(fields).forEach(fieldKey => fieldKeys.add(fieldKey))
		}

		if (docereConfigData.config.hasOwnProperty('metadata')) docereConfigData.config.metadata.forEach(md => fieldKeys.add(md.id))
		if (docereConfigData.config.hasOwnProperty('metadata')) docereConfigData.config.textdata.forEach(td => fieldKeys.add(td.id))

		fieldKeys
			.forEach(key => {
				properties[key] = { type: getType(key, docereConfigData.config) }
			})

		return {
			mappings: { properties }
		}
	}

	async getConfigData(projectId: string) {
		if (this.configDatas.has(projectId)) {
			return this.configDatas.get(projectId)
		}

		const configDataPath = getConfigDataPath(projectId)

		let dcdImport: { default: DocereConfigData }
		try {
			dcdImport = require(configDataPath)
		} catch (err) {
			throw new Error(`[getConfigData] Config file not found at '${configDataPath}'`)
		}

		this.configDatas.set(projectId, dcdImport.default)
		console.log(`Return ${projectId} config`)
		return dcdImport.default
	}

	private async getPage(projectId: string, docereConfigData: DocereConfigData) {
		if (this.pages.has(projectId)) return this.pages.get(projectId)

		const page = await this.browser.newPage()
		page.on('console', (msg: any) => {
			msg = msg.text()
			console.log('From page: ', msg)
		})
		await page.goto('http://localhost:3333')

		await page.addScriptTag({ content: docereConfigData.prepareDocument.toString()	 })
		await page.addScriptTag({ content: docereConfigData.extractFacsimiles.toString() })
		await page.addScriptTag({ content: docereConfigData.extractMetadata.toString()	 })
		await page.addScriptTag({ content: docereConfigData.extractTextData.toString()	 })

		this.pages.set(projectId, page)	
		console.log(`Return ${projectId} page`)
		return page
	}
}
