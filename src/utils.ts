import * as path from 'path'
import * as fs from 'fs'

export function getProjectsDir() {
	return path.resolve(process.cwd(), `node_modules/docere-projects`)
}

export function getProjectDir(projectId: string) {
	return path.resolve(getProjectsDir(), projectId)
}

export function getXMLDir(projectId: string) {
	return path.resolve(getProjectDir(projectId), 'xml')
}

export function getXMLPath(projectId: string, documentId: string) {
	return path.resolve(getXMLDir(projectId), `${documentId}.xml`)
}

export function getConfigDataPath(projectId: string) {
	return path.resolve(getProjectDir(projectId), 'build', 'index.js')
}

export function xmlBasename(filename: string) {
	return path.basename(filename, '.xml')
}

export function readFileContents(projectId: string, file: string) {
	const filePath = getXMLPath(projectId, xmlBasename(file))
	return fs.readFileSync(filePath, 'utf8')
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

export const listProjects = () => fs.readdirSync(getProjectsDir())

/** TODO USE?
function logError(msg: string) {
	console.log("\x1b[31m", msg, "\x1b[0m")
}
*/


// export function clock(start?: [number, number]) {
//     if ( !start ) return process.hrtime();
//     var end = process.hrtime(start);
//     return Math.round((end[0]*1000) + (end[1]/1000000));
// }
// var start = clock()
// var duration = clock(start as any)
// console.log("Took "+duration+"ms")

// export class Project {
// 	constructor(public id: string) {

// 	}

// 	getPath() {
// 		return path.resolve(process.cwd(), `node_modules/docere-config/projects/${this.id}`)
// 	}
// }
