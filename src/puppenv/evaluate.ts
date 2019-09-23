declare global {
	function extractFacsimiles(doc: XMLDocument): ExtractedFacsimile[]
	function extractMetadata(doc: XMLDocument): ExtractedMetadata
	function extractTextData(doc: XMLDocument, config: DocereConfig): ExtractedTextData
	function prepareDocument(doc: XMLDocument, config: DocereConfig, id?: string): XMLDocument
}

export async function prepareAndExtract(xml: string, documentId: string, docereConfig: DocereConfig): Promise<ElasticSearchDocument> {
	const domParser = new DOMParser()
	let xmlRoot: XMLDocument

	try {
		xmlRoot = domParser.parseFromString(xml, "application/xml")
	} catch (err) {
		console.log(`Document ${documentId}: XML parser error`)
	}

	// TODO use ID for when splitting is needed
	// Prepare document
	let doc: XMLDocument
	try {
		doc = await prepareDocument(xmlRoot, docereConfig)
	} catch (err) {
		console.log(`Document ${documentId}: Preparation error`)
	}

	// Text data
	const textData: Record<string, string[]> = {}
	let extractedTextData: ExtractedTextData = {}
	try {
		extractedTextData = extractTextData(doc, docereConfig)
		Object.keys(extractedTextData).forEach(key => {
			const data = extractedTextData[key]
			textData[key] = data.map(d => d.value)
		})
	} catch (err) {
		console.log(`Document ${documentId}: Text data extraction error`)
	}

	// Metadata
	let metadata: ExtractedMetadata = {}
	try {
		metadata = extractMetadata(doc)
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
