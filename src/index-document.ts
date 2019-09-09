import * as es from '@elastic/elasticsearch'

const client = new es.Client({
	node: 'http://localhost:9200'
})

export async function deleteIndex(slug: string) {
	try {
		await client.indices.delete({ index: slug })	
	} catch (err) {
		console.log('deleteIndex', err)	
	}
}

export function getType(key: string, config: DocereConfig): EsDataType {
	let type = EsDataType.keyword

	const mdConfig = config.metadata.find(md => md.id === key)
	if (mdConfig != null && mdConfig.datatype != null) type = mdConfig.datatype

	const tdConfig = config.textdata.find(md => md.id === key)
	if (tdConfig != null && tdConfig.datatype != null) type = tdConfig.datatype

	if (key === 'text') type = EsDataType.text

	return type
}

export function getMapping(metadataKeys: Set<string>, config: DocereConfig) {
	const properties: Record<string, { type: EsDataType }> = {}

	config.metadata.forEach(md => metadataKeys.add(md.id))
	config.textdata.forEach(td => metadataKeys.add(td.id))

	metadataKeys
		.forEach(key => {
			properties[key] = { type: getType(key, config) }
		})

	return {
		mappings: {
			doc: {
				properties
			}
		}
	}
}

export async function createIndex(slug: string, metadataKeys: Set<string>, config: DocereConfig) {
	const properties: Record<string, { type: EsDataType }> = {}

	config.metadata.forEach(md => metadataKeys.add(md.id))
	config.textdata.forEach(td => metadataKeys.add(td.id))

	metadataKeys
		.forEach(key => {
			properties[key] = { type: getType(key, config) }
		})
	
	try {
		await client.indices.create({
			index: slug,
			body: {
				mappings: {
					doc: {
						properties
					}
				}
			}
		})	
	} catch (err) {
		console.log('createIndex', err)
	}
}

export default async function indexDocument(projectSlug: string, indexDocument: any) {
	const { id, ...body } = indexDocument

	try {
		await client.index({
			id,
			index: projectSlug,
			type: 'doc',
			body,
		})
	} catch (err) {
		console.log('indexDocument', err)
	}
}
