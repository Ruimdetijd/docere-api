function getProjectPath(slug: string = '') {
	return path.resolve(`node_modules/docere-config/projects/${slug}`)
}

function logError(msg: string) {
	console.log("\x1b[31m", msg, "\x1b[0m")
}

async function handleProject(projectSlug: string) {
	const configPath = `${getProjectPath(projectSlug)}/index.js`

	if (!fs.existsSync(configPath)) {
		return logError(`No config file for project: ${projectSlug}`)
	}

	const dcdImport: { default: DocereConfigData } = await import(configPath)
	const docereConfigData: DocereConfigData = {
		...defaultDocereConfigData,
		...dcdImport.default,
		config: {...defaultDocereConfigData.config, ...dcdImport.default.config }
	}

	const files = fs.readdirSync(`${getProjectPath(projectSlug)}/xml`) //.slice(0, 30)
	if (!files.length) {
		return logError(`No files found for project: ${projectSlug}`)
	}

	const puppenv = new Puppenv(docereConfigData)
	await puppenv.start()
	const metadataKeys = await puppenv.extractIndexKeys(files)

	await deleteIndex(projectSlug)
	await createIndex(projectSlug, metadataKeys, docereConfigData.config)

	for (const file of files) {
		const indexData = await puppenv.parseFile(file)
		await indexDocument(projectSlug, indexData)
		console.log(`Indexed document "${indexData.id}" of "${projectSlug}"`)
	}

	await puppenv.close()

	// Of all the found metadata and text data remove the already configured keys. 
	// docereConfigData.config.metadata.forEach(md => metadataKeys.delete(md.id))
	// docereConfigData.config.textdata.forEach(td => metadataKeys.delete(td.id))
	// Remove the keys specifically added for the index
	metadataKeys.delete('id')
	metadataKeys.delete('facsimiles')
	metadataKeys.delete('text')
	if (metadataKeys.size) console.warn(`Unconfigured metadata:`, ...metadataKeys)
}

async function main() {
	let projects = process.argv.slice(2, 3)
	if (!projects.length) projects = fs.readdirSync(getProjectPath())

	for (const projectSlug of projects) {
		await handleProject(projectSlug)
	}
}
