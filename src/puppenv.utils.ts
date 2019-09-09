function textContent(el: Element) {
	if (el == null) return null
	return el.textContent
}

function attrsToObject(el: Element) {
	if (el == null) return null
	const attrs: { [key: string]: string } = {}
	for (const attr of el.attributes) {
		attrs[attr.name] = attr.value
	}
	return attrs
}

function xmlToString(doc: XMLDocument, selector: string) {
	if (doc == null || selector == null || !selector.length) return null
	// @ts-ignore
	const xmlio = new XMLio(doc)
	return xmlio.select(selector).export()
}

function attrValue(el: Element, name: string) {
	if (el == null || name == null || !name.length) return null
	return el.getAttribute(name)
}

function wrapElement(
	el: Element,
	nodeName: string = 'div',
	attributes: Attributes = {}
): string {
	if (el == null) return null
	const attrs = Object.keys(attributes).reduce((prev, curr) => `${prev} ${curr}="${attributes[curr]}"`, '')
	return `<${nodeName}${attrs}>${el.innerHTML.replace(/\sxmlns=".*?"/usg, '')}</${nodeName}>`
}

type Attributes = { [key: string]: string }

function wrapInnerHtml(
	doc: XMLDocument | Element,
	selector: string,
	nodeName: string = 'div',
	attributes?: Attributes
): string {
	const el = doc.querySelector(selector)
	if (el == null) return null
	return wrapElement(el, nodeName, attributes)
}

function wrapInnerHtmlAll(
	doc: XMLDocument | Element,
	selector: string,
	nodeName: string = 'div',
	attributes?: Attributes
): string[] {
	const els = Array.from(doc.querySelectorAll(selector))
	if (!els.length) return []
	return els.map(el => wrapElement(el, nodeName, attributes))
}

function fetchXml(url: string): Promise<XMLDocument> {
	return new Promise((resolve, reject) => {
		var xhr = new XMLHttpRequest
		xhr.open('GET', url)
		xhr.responseType = 'document'
		xhr.overrideMimeType('text/xml')

		xhr.onload = function() {
			if (xhr.readyState === xhr.DONE && xhr.status === 200) {
				if (xhr.responseXML == null) {
					reject(`Fetching XML of "${url}" failed`)
					return
				}
				resolve(xhr.responseXML)
			}
		}

		xhr.send()
	})
}