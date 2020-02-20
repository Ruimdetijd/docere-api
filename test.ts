import fetch from 'node-fetch'

/**

# Running tests
`$ npx ts-node test.ts` 

*/

const baseUrl = 'http://localhost:3000/'

async function checkGet(
	url: string,
	test: (response: any) => boolean
) {
	const response = await fetch(url)
	const json = await response.json()

	if (test(json))
		console.log('\x1b[32m%s\x1b[0m', 'Pass');
	else
		console.log('\x1b[31m%s\x1b[0m', 'Fail', JSON.stringify(json));
}

async function main() {
	checkGet(
		`${baseUrl}projects`,
		projects => projects.length > 0
	) 

	checkGet(
		`${baseUrl}projects/gheys/config`,
		config => config.hasOwnProperty('config')
	)

	checkGet(
		`${baseUrl}projects/gheys/documents/${encodeURIComponent('NHA_1617/1780/NL-HlmNHA_1617_1780_0001')}`,
		fields =>
			fields.hasOwnProperty('facsimiles') &&
			fields.hasOwnProperty('id') &&
			fields.hasOwnProperty('text') &&
			fields.hasOwnProperty('metadata') &&
			fields.hasOwnProperty('entities') &&
			!fields.hasOwnProperty('text_suggest')
	)

	checkGet(
		`${baseUrl}projects/gheys/documents/${encodeURIComponent('NHA_1617/1780/NL-HlmNHA_1617_1780_0001')}/fields`,
		fields =>
			fields.hasOwnProperty('facsimiles') &&
			fields.hasOwnProperty('id') &&
			fields.hasOwnProperty('text') &&
			fields.hasOwnProperty('text_suggest') &&
			!fields.hasOwnProperty('metadata') &&
			!fields.hasOwnProperty('entities')
	)

	checkGet(
		`${baseUrl}projects/gheys/mapping`,
		mapping =>
			mapping.hasOwnProperty('mappings') && mapping.mappings.hasOwnProperty('properties') &&
			mapping.mappings.properties.hasOwnProperty('id') &&
			mapping.mappings.properties.id.hasOwnProperty('type') &&
			mapping.mappings.properties.id.type === 'keyword'
	)
}

main()
