declare global {
	const DocereProjects: any
}

export async function prepareAndExtract(xml: string, documentId: string, projectId: string): Promise<ElasticSearchDocument | { __error: string }> {
	const domParser = new DOMParser()
	let xmlRoot: XMLDocument

	// TODO fix if configData not found
	const docereConfigData: DocereConfigData = (await DocereProjects.default[projectId]()).default

	try {
		xmlRoot = domParser.parseFromString(xml, "application/xml")
	} catch (err) {
		return { __error: `Document ${documentId}: XML parser error\n${JSON.stringify(err)}` }
	}

	if (xmlRoot.querySelector('parsererror')) {
		// Check the namespace to be certain it is a parser error and not an element named "parsererror"
		// See: https://stackoverflow.com/questions/11563554/how-do-i-detect-xml-parsing-errors-when-using-javascripts-domparser-in-a-cross
		const parsererrorNS = domParser.parseFromString('INVALID', 'text/xml').getElementsByTagName("parsererror")[0].namespaceURI
		const parsererrors = xmlRoot.getElementsByTagNameNS(parsererrorNS, 'parsererror')
		if (parsererrors.length) {
			return { __error: parsererrors[0].textContent }
		}
	}

	// TODO use ID for when splitting is needed
	// Prepare document
	// console.log(prepareDocument.toString())
	let doc: XMLDocument
	try {
		doc = await docereConfigData.prepareDocument(xmlRoot, docereConfigData.config, documentId)
	} catch (err) {
		return { __error: `Document ${documentId}: Preparation error\n${JSON.stringify(err)}` }
	}

	// Text data
	let textData: Record<string, string[]> = {}
	let extractedTextData: Entity[] = []
	try {
		extractedTextData = docereConfigData.extractTextData(doc, docereConfigData.config)
		textData = extractedTextData.reduce((prev, curr) => {
			if (prev.hasOwnProperty(curr.type)) {
				prev[curr.type] = prev[curr.type].concat(curr.value)
			} else {
				prev[curr.type] = [curr.value]
			}
			// prev[curr.id] = curr.value
			return prev
		}, {} as Record<string, string[]>)
		// textData[key] = data
		// for (const [key, data] of extractedTextData.entries()) {
		// }
	} catch (err) {
		return { __error: `Document ${documentId}: Text data extraction error\n${JSON.stringify(err)}` }
	}

	// Metadata
	let metadata: ExtractedMetadata = {}
	try {
		metadata = docereConfigData.extractMetadata(doc, docereConfigData.config, documentId)
	} catch (err) {
		return { __error: `Document ${documentId}: Metadata extraction error\n${JSON.stringify(err)}` }
	}

	// Facsimiles
	let facsimiles: ExtractedFacsimile[] = []
	try {
		facsimiles = docereConfigData.extractFacsimiles(doc, docereConfigData.config)

		// For indexing, we only need the facsimile paths
		facsimiles = facsimiles.reduce((prev, curr) => prev.concat(curr.versions.map(v => v.path)), [])
	} catch (err) {
		return { __error: `Document ${documentId}: Facsimile extraction error\n${JSON.stringify(err)}` }
	}

	const text = doc.documentElement.textContent

	return {
		id: documentId,
		text,
		text_suggest: {
			input: text.split(' '),
		},
		facsimiles,
		...metadata,
		...textData
	}
}
