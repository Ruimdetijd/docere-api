import fetch from 'node-fetch'

function check(valid: boolean) {
	if (valid)	console.log('\x1b[32m%s\x1b[0m', 'Pass');
	else		console.log('\x1b[31m%s\x1b[0m', 'Fail');
}

async function main() {
	const response = await fetch('http://localhost:3000/projects')
	const projects = await response.json()
	check(projects.length > 0) 

	const response2 = await fetch('http://localhost:3000/projects/gheys/config')
	const config = await response2.json()
	check(config.hasOwnProperty('config'))

	const documentId = encodeURIComponent('nl-gngra/85/32/nl-gngra_85_32_0001')
	const response3 = await fetch(`http://localhost:3000/projects/gheys/documents/${documentId}`)
	const fields = await response3.json()
	check(
		fields.hasOwnProperty('facsimiles') &&
		fields.hasOwnProperty('id') &&
		fields.hasOwnProperty('text')
	)
}

main()
