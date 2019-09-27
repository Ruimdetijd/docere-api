import * as fs from 'fs'
import * as path from 'path'
import * as es from '@elastic/elasticsearch'
import Puppenv from './puppenv'
import { getProjectPath } from './utils'

const puppenv = new Puppenv()
const esClient = new es.Client({
	node: 'http://localhost:9200',
})


async function handleProject(projectId: string) {
	const xmlDirPath = path.resolve(getProjectPath(projectId), 'xml')
	const files = fs.readdirSync(xmlDirPath)

	// Get the ElasticSearch mapping for the project
	let mapping: Mapping
	try {
		mapping = await puppenv.getMapping(projectId, files)
	} catch (err) {
		return console.log(err.message)
	}

	// Delete the previous index
	try {
		await esClient.indices.delete({ index: projectId })	
	} catch (err) {
		console.log('deleteIndex', err)	
	}

	// Create a fresh index
	try {
		await esClient.indices.create({
			index: projectId,
			body: mapping
		})	
	} catch (err) {
		console.log('createIndex', err)
	}

	// Insert every XML file one by one
	for (const file of files) {
		const xml = fs.readFileSync(path.resolve(xmlDirPath, file), 'utf8')
		const esDocument = await puppenv.getDocumentFields(xml, projectId, path.basename(file, '.xml'))
		if (esDocument.hasOwnProperty('__error')) return esDocument.__error
		const { id, ...body } = esDocument as ElasticSearchDocument
		
		try {
			await esClient.index({
				// id,
				index: projectId,
				// type: 'doc',
				body,
			})
			console.log(`Indexed ${file} from project '${projectId}'`)
		} catch (err) {
			console.log(err)	
		}
	}
}

async function main() {
	await puppenv.start()
	
	let projects = process.argv.slice(2, 3)
	if (!projects.length) projects = fs.readdirSync(getProjectPath())
	for (const projectSlug of projects) {
		await handleProject(projectSlug)
	}

	await puppenv.close()
	esClient.close()
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
