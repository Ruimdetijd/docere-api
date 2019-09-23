import * as path from 'path'
import * as fs from 'fs'

export function getProjectPath(projectId: string = '') {
	return path.resolve(process.cwd(), `node_modules/docere-config/projects/${projectId}`)
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

export const listProjects = () => fs.readdirSync(getProjectPath())

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
