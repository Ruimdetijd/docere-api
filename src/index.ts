import express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import Puppenv from './puppenv'
import './puppenv.utils'
import { getProjectPath } from './utils'

const app = express()
const port = 3000

app.use((req, res, next) => {
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

	// app.get('/mapping/gekaaptebrieven', async (req, res) => {
	// 	res.setHeader('Content-Type', 'application/json')
	// 	res.send(`{"mappings":{"doc":{"properties":{"id":{"type":"keyword"},"text":{"type":"text"},"facsimiles":{"type":"keyword"},"corr":{"type":"keyword"},"texttypes":{"type":"keyword"},"languages":{"type":"keyword"},"has_date":{"type":"boolean"},"sender_or_recipient":{"type":"keyword"},"person":{"type":"keyword"},"org":{"type":"keyword"},"loc":{"type":"keyword"},"misc":{"type":"keyword"},"date":{"type":"date"},"recipient":{"type":"keyword"},"recipientloc":{"type":"keyword"},"recipientgender":{"type":"keyword"},"recipientprof":{"type":"keyword"},"sender":{"type":"keyword"},"senderprof":{"type":"keyword"},"senderloc":{"type":"keyword"},"sendergender":{"type":"keyword"},"recipientship":{"type":"keyword"},"sendership":{"type":"keyword"}}}}}`)
	// })

	// app.get('/mapping/kranten1700', async (req, res) => {
	// 	res.setHeader('Content-Type', 'application/json')
	// 	res.send(`{"mappings":{"doc":{"properties":{"id":{"type":"keyword"},"text":{"type":"text"},"facsimiles":{"type":"keyword"},"article":{"type":"keyword"},"article_id":{"type":"keyword"},"article_title":{"type":"keyword"},"colophon":{"type":"keyword"},"colophon_text":{"type":"keyword"},"date":{"type":"date"},"err_text_type":{"type":"keyword"},"docId":{"type":"keyword"},"language":{"type":"keyword"},"paper_id":{"type":"keyword"},"paper_title":{"type":"keyword"},"pos":{"type":"keyword"},"org":{"type":"keyword"},"per":{"type":"keyword"},"loc":{"type":"keyword"},"misc":{"type":"keyword"}}}}}`)
	// })

	app.get('/mapping/:projectId', async (req, res) => {
		const baseDir = getProjectPath(req.params.projectId) + '/xml'
		let files: string[]

		try {
			files = fs.readdirSync(baseDir)
		} catch (err) {
			console.log(err)
			res.status(404).end()	
			return
		}

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
		const fileContents = await Promise.all(files2.map(async (file) => await fs.readFileSync(path.resolve(baseDir, file), 'utf8')))
		const mapping = await puppenv.getMapping(fileContents, req.params.projectId)
		res.json(mapping)
	})

	app.post('/documentfields/:projectId/:documentId', async (req, res) => {
		const documentFields = await puppenv.getDocumentFields(req.body, req.params.projectId, req.params.documentId)
		res.json(documentFields)
	})

	app.listen(port, () => console.log(`Docere ElasticSearch index data service running on port ${port}`))
}

main()
