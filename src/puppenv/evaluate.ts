declare global {
	const extractFacsimiles: DocereConfigDataRaw['extractFacsimiles']
	const extractMetadata: DocereConfigDataRaw['extractMetadata']
	const extractTextData: DocereConfigDataRaw['extractTextData']
	const prepareDocument: DocereConfigDataRaw['prepareDocument']
}

export async function prepareAndExtract(xml: string, documentId: string, docereConfig: DocereConfig): Promise<ElasticSearchDocument | { __error: string }> {
	const domParser = new DOMParser()
	let xmlRoot: XMLDocument

	try {
		xmlRoot = domParser.parseFromString(xml, "application/xml")
	} catch (err) {
		console.log(`Document ${documentId}: XML parser error`)
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
		doc = await prepareDocument(xmlRoot, docereConfig, documentId)
	} catch (err) {
		console.log(`Document ${documentId}: Preparation error`)
	}

	// Text data
	const textData: Record<string, string[]> = {}
	let extractedTextData: ExtractedTextData = new Map()
	try {
		extractedTextData = extractTextData(doc, docereConfig)
		for (const [key, data] of extractedTextData.entries()) {
			textData[key] = Array.from(data.values()).map(d => d.value)
		}
	} catch (err) {
		console.log(`Document ${documentId}: Text data extraction error`)
	}

	// Metadata
	let metadata: ExtractedMetadata = {}
	try {
		metadata = extractMetadata(doc, docereConfig, documentId)
	} catch (err) {
		console.log(`Document ${documentId}: Metadata extraction error`)
	}

	// Facsimiles
	let facsimiles: ExtractedFacsimile[] = []
	try {
		facsimiles = extractFacsimiles(doc)
		facsimiles = facsimiles.reduce((prev, curr) => prev.concat(curr.path), [])
	} catch (err) {
		console.log(`Document ${documentId}: Facsimile extraction error`)
	}
	

	return {
		// id: fileName.slice(-4) === '.xml' ? fileName.slice(0, -4) : fileName,
		id: documentId,
		text: doc.documentElement.textContent,
		// For indexing, we only need the facsimile paths
		facsimiles,
		...metadata,
		...textData
	}
}
