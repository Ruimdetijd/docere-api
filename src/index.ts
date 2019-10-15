/// <reference types="docere"/>

import express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import Puppenv from './puppenv'
import { getProjectPath, listProjects } from './utils'

const app = express()
const port = 3000

app.use((req, _res, next) => {
	if (req.get('Content-Type') === 'application/xml' || req.get('Content-Type') === 'text/xml') {
		req.body = ''
		req.setEncoding('utf8')
		req.on('data', (chunk) => { req.body += chunk })
		req.on('end', next)
	} else {
		next()
	}
})


async function main() {
	const puppenv = new Puppenv()
	await puppenv.start()

	app.get('/projects', (_req, res) => {
		res.json(listProjects())
	})

	app.get('/projects/:projectId/config', async (req, res) => {
		const config = await puppenv.getConfig(req.params.projectId)

		if (config == null) {
			return res.status(404).end()
		}

		res.json(config)
	})

	app.get('/projects/:projectId/mapping', async (req, res) => {
		const xmlDirPath = path.resolve(getProjectPath(req.params.projectId), 'xml')
		let files: string[]

		try {
			files = fs.readdirSync(xmlDirPath)
		} catch (err) {
			return res.status(404).json({ error: `No XML found for project '${req.params.projectId}'`})	
		}

		let mapping: Mapping
		try {
			mapping = await puppenv.getMapping(req.params.projectId, files)
		} catch (err) {
			return res.status(404).json({ error: err.message })	
		}
		res.json(mapping)
	})

	app.get('/projects/:projectId/documents/:documentId', async (req, res) => {
		let contents
		const filePath = path.resolve(getProjectPath(req.params.projectId), 'xml', `${req.params.documentId}.xml`)

		try {
			contents = await fs.readFileSync(filePath, 'utf8')
		} catch (err) {
			return res.status(404).json({ error: `File '${req.params.documentId}.xml' for project '${req.params.projectId}' not found`})	
		}

		let documentFields: ElasticSearchDocument
		try {
			documentFields = await puppenv.getDocumentFields(contents, req.params.projectId, req.params.documentId)
		} catch (err) {
			return res.status(400).json({ error: err.message })
		}

		res.json(documentFields)
	})

	app.post('/projects/:projectId/documents/:documentId/fields', async (req, res) => {
		if (req.headers['content-type'] !== 'application/xml' && req.headers['content-type'] !== 'text/xml') {
			return res.status(415).json({ error: 'Missing the HTTP Content-type header for XML' })
		}
		if (req.body == null || !req.body.length) {
			return res.status(400).json({ error: 'The payload body should be the contents of an XML file.' })
		}

		let documentFields: ElasticSearchDocument
		try {
			documentFields = await puppenv.getDocumentFields(req.body, req.params.projectId, req.params.documentId)
		} catch (err) {
			return res.status(400).json({ error: err.message })
		}

		if (documentFields == null) return res.status(404).end()

		res.json(documentFields)
	})


	app.get('/api/dts', (_req, res) => {
		res.json({
			"@context": "dts/EntryPoint.jsonld",
			"@id": "/api/dts",
			"@type": "EntryPoint",
			"collections": "/api/dts/collections",
			"documents": "/api/dts/document",
			"navigation": "/api/dts/navigation",
		})
	})

	app.get('/api/dts/collections', (req, res) => {
		console.log(req.query)
		const projectIds = listProjects()
		// if (req.query.hasOwnProperty('id')) {

		// 	{
		// 		"@context": {
		// 			"@vocab": "https://www.w3.org/ns/hydra/core#",
		// 			"ns2": "http://purl.org/dc/elements/1.1/",
		// 			"cts": "http://chs.harvard.edu/xmlns/cts/",
		// 			"dts": "https://w3id.org/dts/api#",
		// 			"ns1": "http://www.w3.org/2004/02/skos/core#"
		// 		},
		// 		"@type": "Collection",
		// 		"title": "Ajax",
		// 		"@id": "urn:cts:greekLit:tlg0011.tlg003",
		// 		"totalItems": 1,
		// 		"member": [
		// 			{
		// 				"dts:references": "/api/dts/navigation?id=urn%3Acts%3AgreekLit%3Atlg0011.tlg003.alpheios-text-grc1",
		// 				"@type": "Resource",
		// 				"title": "Alpheios Enhanced Ajax",
		// 				"@id": "urn:cts:greekLit:tlg0011.tlg003.alpheios-text-grc1",
		// 				"dts:citeDepth": 1,
		// 				"totalItems": 0,
		// 				"dts:passage": "/api/dts/document?id=urn%3Acts%3AgreekLit%3Atlg0011.tlg003.alpheios-text-grc1",
		// 				"dts:extensions": {
		// 					"ns2:language": "grc",
		// 					"cts:description": [
		// 						{"@value": "TEI with Syntax Diagrams", "@language": "eng"}
		// 					],
		// 					"cts:label": [
		// 						{"@value": "Alpheios Enhanced Ajax", "@language": "eng"}
		// 					],
		// 					"ns1:prefLabel": [
		// 						{"@value": "Alpheios Enhanced Ajax", "@language": "eng"}
		// 					]
		// 				}
		// 			}
		// 		],
		// 		"dts:extensions": {
		// 			"ns2:language": "grc",
		// 			"cts:title": [
		// 				{"@value": "Ajax", "@language": "eng"}
		// 			],
		// 			"ns1:prefLabel": [
		// 				{"@value": "Ajax", "@language": "eng"}
		// 			]
		// 		}
		// 	}
		// }

		res.json({
			"@context": {
				"dts": "https://w3id.org/dts/api#",
				"@vocab": "https://www.w3.org/ns/hydra/core#"
			},
			"@type": "Collection",
			"title": "Docere collections",
			"@id": "docerecollections",
			"totalItems": projectIds.length,
			"member": projectIds.map(id => (
				{
					"totalItems": 4,
					"@type": "Collection",
					"title": "Grec Ancien",
					"@id": id
				}
			))
		})
	})

	app.listen(port, () => console.log(`Docere ElasticSearch index data service running on port ${port}`))
}

main()


	// app.get('/mapping/gekaaptebrieven', async (req, res) => {
	// 	res.setHeader('Content-Type', 'application/json')
	// 	res.send(`{"mappings":{"doc":{"properties":{"id":{"type":"keyword"},"text":{"type":"text"},"facsimiles":{"type":"keyword"},"corr":{"type":"keyword"},"texttypes":{"type":"keyword"},"languages":{"type":"keyword"},"has_date":{"type":"boolean"},"sender_or_recipient":{"type":"keyword"},"person":{"type":"keyword"},"org":{"type":"keyword"},"loc":{"type":"keyword"},"misc":{"type":"keyword"},"date":{"type":"date"},"recipient":{"type":"keyword"},"recipientloc":{"type":"keyword"},"recipientgender":{"type":"keyword"},"recipientprof":{"type":"keyword"},"sender":{"type":"keyword"},"senderprof":{"type":"keyword"},"senderloc":{"type":"keyword"},"sendergender":{"type":"keyword"},"recipientship":{"type":"keyword"},"sendership":{"type":"keyword"}}}}}`)
	// })

	// app.get('/mapping/kranten1700', async (req, res) => {
	// 	res.setHeader('Content-Type', 'application/json')
	// 	res.send(`{"mappings":{"doc":{"properties":{"id":{"type":"keyword"},"text":{"type":"text"},"facsimiles":{"type":"keyword"},"article":{"type":"keyword"},"article_id":{"type":"keyword"},"article_title":{"type":"keyword"},"colophon":{"type":"keyword"},"colophon_text":{"type":"keyword"},"date":{"type":"date"},"err_text_type":{"type":"keyword"},"docId":{"type":"keyword"},"language":{"type":"keyword"},"paper_id":{"type":"keyword"},"paper_title":{"type":"keyword"},"pos":{"type":"keyword"},"org":{"type":"keyword"},"per":{"type":"keyword"},"loc":{"type":"keyword"},"misc":{"type":"keyword"}}}}}`)
	// })
