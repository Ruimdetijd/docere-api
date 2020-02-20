/// <reference types="docere"/>

import * as path from 'path'
import express from 'express'
import Puppenv from './puppenv'
import { listProjects, isError, getElasticSearchDocument, send } from './utils'
import handleProjectApi from './api/project'
import handleDtsApi from './api/dts'

const app = express()
app.disable('x-powered-by')
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

	app.get('/', (_req, res) => res.json({
		title: 'Docere API',
		version: '0.0.0'
	}))

	app.get('/swaggerconfig', (_req, res) => {
		res.sendFile(path.resolve('./swagger.yml'))
	})

	app.get('/projects', (_req, res) => send(listProjects(), res))

	handleProjectApi(app, puppenv)
	handleDtsApi(app)

	app.get('/projects/:projectId/documents/:documentId', async (req, res) => {
		const documentFields = await puppenv.prepareAndExtractFromFile(req.params.projectId, req.params.documentId)
		send(documentFields, res)
	})

	app.get('/projects/:projectId/documents/:documentId/metadata', async (req, res) => {
		const x = await puppenv.prepareAndExtractFromFile(req.params.projectId, req.params.documentId)
		if (isError(x)) send(x, res)
		else send((x as PrepareAndExtractOutput).metadata, res)
	})

	app.get('/projects/:projectId/documents/:documentId/facsimiles', async (req, res) => {
		const x = await puppenv.prepareAndExtractFromFile(req.params.projectId, req.params.documentId)
		if (isError(x)) send(x, res)
		else send((x as PrepareAndExtractOutput).facsimiles, res)
	})

	app.get('/projects/:projectId/documents/:documentId/fields', async (req, res) => {
		const x = await puppenv.prepareAndExtractFromFile(req.params.projectId, req.params.documentId)
		send(getElasticSearchDocument(x), res)
	})

	/*
	 * Usage example:
	 * $ curl -X POST localhost:3000/projects/<projectId>/documents/<docId>/fields -H content-type:text/xml -d @/path/to/file.xml
	 */
	app.post('/projects/:projectId/documents/:documentId/fields', async (req, res) => {
		if (req.headers['content-type'] !== 'application/xml' && req.headers['content-type'] !== 'text/xml') {
			send({ code: 415, __error: 'Missing the HTTP Content-type header for XML' }, res)
		}
		if (req.body == null || !req.body.length) {
			send({ __error: 'The payload body should be the contents of an XML file.' }, res)
		}

		const x = await puppenv.prepareAndExtract(req.body, req.params.projectId, req.params.documentId)
		send(getElasticSearchDocument(x), res)
	})

	app.listen(port, () => console.log(`Docere API running on port ${port}`))
}

main()
