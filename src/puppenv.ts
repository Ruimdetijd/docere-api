import puppeteer from 'puppeteer'
import express from 'express'
import { Server } from 'http'
import { getType } from './index-document'
import { getProjectPath, clock } from './utils'
require = require('esm')(module) 
const defaultDocereConfigData = require('docere-config').default

declare function extractFacsimiles(doc: XMLDocument): ExtractedFacsimile[]
declare function extractMetadata(doc: XMLDocument): ExtractedMetadata
declare function extractTextData(doc: XMLDocument, config: DocereConfig): ExtractedTextData
declare function prepareDocument(doc: XMLDocument, config: DocereConfig, id?: string): XMLDocument

async function evaluateParseFile(documentId: string, xml: string, docereConfig: DocereConfig): Promise<IndexData> {
	const domParser = new DOMParser()
	const xmlRoot = domParser.parseFromString(xml, "application/xml")

	// TODO use ID for when splitting is needed
	// Prepare document
	const doc = await prepareDocument(xmlRoot, docereConfig)

	// Text data
	let textData = {} as any
	const textdataTmp = extractTextData(doc, docereConfig)
	Object.keys(textdataTmp).forEach(key => {
		const data = textdataTmp[key]
		textData[key] = data.map(d => d.value)
	})

	// Metadata
	let metadata: any = {}
	try {
		metadata = extractMetadata(doc)
	} catch (err) {
		console.log(`Document ${documentId}: Metadata extraction error`)
	}

	return {
		// id: fileName.slice(-4) === '.xml' ? fileName.slice(0, -4) : fileName,
		id: documentId,
		text: doc.documentElement.textContent,
		// For indexing, we only need the facsimile paths
		facsimiles: extractFacsimiles(doc).reduce((prev, curr) => prev.concat(curr.path), []),
		...metadata,
		...textData
	}
}

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
				'--disable-setuid-sandbox',
			]
		})

		console.log('Puppeteer launched')
	}

	private async getPage(projectId: string, docereConfigData: DocereConfigData) {
		if (this.pages.has(projectId)) {
			console.log(`Return ${projectId} page (from cache)`)
			return this.pages.get(projectId)
		}

		const page = await this.browser.newPage()
		page.on('console', (msg: any) => {
			msg = msg.text()
			console.log('From page: ', msg)
		})
		await page.goto('http://localhost:3333')

		await page.addScriptTag({ path: `./build/puppenv.utils.js` })
		await page.addScriptTag({ content: docereConfigData.prepareDocument.toString() })
		await page.addScriptTag({ content: docereConfigData.extractFacsimiles.toString() })
		await page.addScriptTag({ content: docereConfigData.extractMetadata.toString() })
		await page.addScriptTag({ content: docereConfigData.extractTextData.toString() })

		this.pages.set(projectId, page)	
		console.log(`Return ${projectId} page`)
		return page
	}

	private async getConfig(projectId: string) {
		if (this.configs.has(projectId)) {
			console.log(`Return ${projectId} config (from cache)`)
			return this.configs.get(projectId)
		}

		const configPath = `${getProjectPath(projectId)}/index.js`
		const dcdImport: { default: DocereConfigData } = await import(configPath)
		const docereConfigData: DocereConfigData = {
			...defaultDocereConfigData,
			...dcdImport.default,
			config: {...defaultDocereConfigData.config, ...dcdImport.default.config }
		}

		this.configs.set(projectId, docereConfigData)

		console.log(`Return ${projectId} config`)
		return docereConfigData
	}

	async getDocumentFields(xml: string, projectId: string, documentId: string) {
		const docereConfigData = await this.getConfig(projectId)
		const page = await this.getPage(projectId, docereConfigData)

		var start = clock()
		const result = await page.evaluate(
			evaluateParseFile,
			documentId,
			xml,
			docereConfigData.config as any,
		)
		var duration = clock(start as any)
		console.log("Took "+duration+"ms")
		return result
	}

	async getMapping(xmlContents: string[], projectId: string) {
		const properties: Record<string, { type: EsDataType }> = {}
		const docereConfigData = await this.getConfig(projectId)

		const fieldKeys = new Set<string>()
		for (const xml of xmlContents) {
			const fields = await this.getDocumentFields(xml, projectId, null)
			Object.keys(fields).forEach(fieldKey => fieldKeys.add(fieldKey))
		}

		docereConfigData.config.metadata.forEach(md => fieldKeys.add(md.id))
		docereConfigData.config.textdata.forEach(td => fieldKeys.add(td.id))

		fieldKeys
			.forEach(key => {
				properties[key] = { type: getType(key, docereConfigData.config) }
			})

		return {
			mappings: {
				doc: {
					properties
				}
			}
		}
	}

	async extractIndexKeys(projectId: string, files: string[]) {
		const docereConfigData = await this.getConfig(projectId)
		const page = await this.getPage(projectId, docereConfigData)

		const keys: Set<string> = new Set()

		// Take a subset of the files to extract the metadata. If we do all the files
		// it can take a very long time. The extracted data is combined with the metadata
		// and textdata config to create an Elastic Search mapping. Without this extraction
		// we would miss the non-configured metadata and textdata. Without the config
		// metadata and textdata IDs we could miss a metadata or text data which is not
		// defined in the subset.
		const files2 = [
			files[0],
			files[Math.floor(files.length * .125)],
			files[Math.floor(files.length * .25)],
			files[Math.floor(files.length * .375)],
			files[Math.floor(files.length * .5)],
			files[Math.floor(files.length * .625)],
			files[Math.floor(files.length * .75)],
			files[Math.floor(files.length * .875)],
			files[files.length - 1]
		]	

		for (const file of files2) {
			const data = await page.evaluate(
				evaluateParseFile,
				docereConfigData.config as any,
				file
			)
			Object.keys(data).forEach(key => keys.add(key))
		}

		return keys
	}

	close() {
		this.browser.close()
		this.server.close()
	}
}
