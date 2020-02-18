import * as path from 'path'
import * as fs from 'fs'

export function getProjectsSourceDir() {
	return path.resolve(process.cwd(), `node_modules/docere-projects/src`)
}

export function getProjectSourceDir(projectId: string) {
	return path.resolve(getProjectsSourceDir(), projectId)
}

export function getXmlDir(projectId: string) {
	return path.resolve(getProjectSourceDir(projectId), 'xml')
}

export function getXMLPath(projectId: string, documentId: string) {
	return path.resolve(getXmlDir(projectId), `${documentId}.xml`)
}

export function getEntryIdFromFilePath(xmlFilePath: string, projectId: string) {
	const dir = path.dirname(xmlFilePath).replace(getXmlDir(projectId), '')
	const base = path.basename(xmlFilePath, '.xml')

	return `${dir}/${base}`.replace(/^\//, '')
}

export function readFileContents(filePath: string) {
	return fs.readFileSync(filePath, 'utf8')
}

export function getType(key: string, config: DocereConfig): EsDataType {
	let type = EsDataType.Keyword

	const mdConfig = config.metadata.find(md => md.id === key)
	if (mdConfig != null && mdConfig.datatype != null) type = mdConfig.datatype

	const tdConfig = config.textData.find(md => md.id === key)
	if (tdConfig != null && tdConfig.datatype != null) type = tdConfig.datatype

	if (key === 'text') type = EsDataType.Text
	if (type === EsDataType.Hierarchy) type = EsDataType.Keyword

	if (type === EsDataType.Null) return null

	return type
}

export function listProjects() {
	return fs.readdirSync(getProjectsSourceDir(), { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
}

/**
 * Check if dirent is XML file
 */
function isXmlFile(dirent: fs.Dirent) { return dirent.isFile() && path.extname(dirent.name) === '.xml' }

/**
 * An entry can exist of multiple XML files, but this
 * recursive function returns only the "main" XML files.
 */
function getMainXmlFilePathsFromDir(dir: string, maxPerDir: number = null) {
	const files: string[] = []
	const dirents = fs.readdirSync(dir, { withFileTypes: true })
	let xmlFiles = dirents.filter(isXmlFile)
	if (maxPerDir != null) xmlFiles = xmlFiles.slice(0, maxPerDir)

	if (xmlFiles.length) {
		xmlFiles.forEach(f => files.push(`${dir}/${f.name}`))
	} else {
		dirents
			.filter(x => x.isDirectory() || x.isSymbolicLink())
			.forEach(x => {
				getMainXmlFilePathsFromDir(`${dir}/${x.name}`, maxPerDir)
					.forEach(f => files.push(f))
			})
	}

	return files
}

export async function getXmlFiles(projectId: string, maxPerDir: number = null) {
	const baseDir = getXmlDir(projectId)
	return getMainXmlFilePathsFromDir(baseDir, maxPerDir)
}
