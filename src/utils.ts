import * as path from 'path'

export function getProjectPath(projectId: string = '') {
	return path.resolve(process.cwd(), `node_modules/docere-config/projects/${projectId}`)
}

export function clock(start?: [number, number]) {
    if ( !start ) return process.hrtime();
    var end = process.hrtime(start);
    return Math.round((end[0]*1000) + (end[1]/1000000));
}
