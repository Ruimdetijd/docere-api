/**
 * JSON object which represents a ElasticSearch document
 */
interface ElasticSearchDocument {
	id: string
	text: string
	facsimiles: ExtractedFacsimile[]
	[key: string]: any
}
type MappingProperties = Record<string, {
	type: EsDataType,
	[key: string]: string | number | boolean
}>

interface Mapping {
	mappings: {
		properties: MappingProperties
	}
}
