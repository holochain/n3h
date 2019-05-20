const fs = require('fs')
const path = require('path')
const jsdoc2md = require('jsdoc-to-markdown')

/**
 */
module.exports = exports = async function docs () {
  await _genAllDocs()
}

/**
 */
async function _genAllDocs () {
  let alldocs = `# documentation

## projects

`
  const baseDir = path.resolve(path.join(__dirname, '..'))
  const projects = fs.readdirSync(path.join(baseDir, 'lib'))
  projects.sort()
  for (let project of projects) {
    const fn = path.join(baseDir, 'lib', project)
    if (!fs.lstatSync(fn).isDirectory()) {
      continue
    }
    console.log('gen docs for', fn)
    const ret = await _genDocs(fn, project)
    if (typeof ret === 'string' && ret.length) {
      alldocs += `### ${project}

${ret}
`
    }
  }

  const docfile = path.join(baseDir, 'docs', 'index.md')
  fs.writeFileSync(docfile, alldocs)
}

/**
 */
async function _genDocs (dir, project) {
  let doclist = ''

  const docDir = path.resolve(path.join(__dirname, '..', 'docs'))

  const docListFile = path.resolve(path.join(dir, 'docList.json'))
  let docListJson = null
  try {
    docListJson = JSON.parse(fs.readFileSync(docListFile).toString())
  } catch (e) {
    console.log('skipping', dir, 'docList.json read error')
    return
  }
  if (
    typeof docListJson !== 'object' ||
    Object.keys(docListJson).length < 1
  ) {
    console.log('no docs listed for', dir)
    return
  }

  const projectDocDir = path.join(docDir, project)
  _assertDir(projectDocDir)

  const docKeys = Object.keys(docListJson)
  docKeys.sort()
  for (let docName of docKeys) {
    const docPath = path.join(dir, docListJson[docName])
    console.log('generate docs for', docName, docPath)
    const md = await jsdoc2md.render({ files: docPath })

    fs.writeFileSync(path.join(projectDocDir, docName + '.md'), md)

    doclist += '- [' + docName + '](' + project + '/' + docName + '.md)\n'
  }

  return doclist
}

/**
 */
async function _assertDir (dir) {
  try {
    const s = fs.statSync(dir)
    if (!s.isDirectory()) {
      throw new Error('not directory')
    }
  } catch (e) {
    fs.mkdirSync(dir)
  }
}
