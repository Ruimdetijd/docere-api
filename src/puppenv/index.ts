import * as fs from 'fs'
import * as path from 'path'
import puppeteer from 'puppeteer'
import express from 'express'
import { Server } from 'http'
import { getProjectPath, getType } from '../utils'
import { prepareAndExtract } from './evaluate'

require = require('esm')(module) 
const defaultDocereConfigData: DocereConfigData = require('docere-config').default

export default class Puppenv {
	private browser: puppeteer.Browser
	private server: Server
	private pages: Map<string, puppeteer.Page> = new Map()
	private configs: Map<string, DocereConfigData> = new Map()

	constructor() {
		const app = express()
		app.disable('x-powered-by')
		app.use(express.static(`node_modules/docere-config/projects`))
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

	async getDocumentFields(xml: string, projectId: string, documentId?: string) {
		const docereConfigData = await this.getConfig(projectId)
		if (docereConfigData == null) throw new Error(`No config found for project '${projectId}'`)

		const page = await this.getPage(projectId, docereConfigData)

		const result = await page.evaluate(
			prepareAndExtract,
			xml,
			documentId,
			docereConfigData.config as any,
		)
		return result
	}

	async getMapping(projectId: string, fileNames: string[]): Promise<Mapping> {
		const properties: MappingProperties = {}
		const docereConfigData = await this.getConfig(projectId)
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

		const getXmlFilePath = (file: string) => path.resolve(getProjectPath(projectId), 'xml', file)
		const readFileContents = async (file: string) => await fs.readFileSync(getXmlFilePath(file), 'utf8')
		const xmlContents = await Promise.all(selectedFileNames.map(readFileContents))

		const fieldKeys = new Set<string>()
		for (const xml of xmlContents) {
			const fields = await this.getDocumentFields(xml, projectId)
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
		// return {
		// 	mappings: {
		// 		doc: {
		// 			properties
		// 		}
		// 	}
		// }
	}

	async getConfig(projectId: string) {
		if (this.configs.has(projectId)) {
			return this.configs.get(projectId)
		}

		const configPath = `${getProjectPath(projectId)}/index.js`
		let dcdImport: { default: DocereConfigData }
		try {
			dcdImport = await import(configPath)
		} catch (err) {
			throw new Error('[getConfig] Config file not found')
		}


		const docereConfigData: DocereConfigData = {
			...defaultDocereConfigData,
			...dcdImport.default,
			config: {...defaultDocereConfigData.config, ...dcdImport.default.config }
		}

		this.configs.set(projectId, docereConfigData)
		console.log(`Return ${projectId} config`)
		return docereConfigData
	}

	private async getPage(projectId: string, docereConfigData: DocereConfigData) {
		if (this.pages.has(projectId)) {
			return this.pages.get(projectId)
		}

		const page = await this.browser.newPage()
		page.on('console', (msg: any) => {
			msg = msg.text()
			console.log('From page: ', msg)
		})
		await page.goto('http://localhost:3333')

		await page.addScriptTag({ content: docereConfigData.prepareDocument.toString() })
		await page.addScriptTag({ content: docereConfigData.extractFacsimiles.toString() })
		await page.addScriptTag({ content: docereConfigData.extractMetadata.toString() })
		await page.addScriptTag({ content: docereConfigData.extractTextData.toString() })

		this.pages.set(projectId, page)	
		console.log(`Return ${projectId} page`)
		return page
	}
}
