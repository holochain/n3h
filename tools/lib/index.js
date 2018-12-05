const fs = require('fs')
const path = require('path')
const jsdoc2md = require('jsdoc-to-markdown')

const handlebars = require('handlebars')

/**
 */
exports.docs = async function docs () {
  await _genAllDocs()
}

/**
 */
exports.buildTemplate = async function buildTemplate (opts) {
  if (
    typeof opts !== 'object' ||
    typeof opts.projectName !== 'string' ||
    typeof opts.projectDesc !== 'string' ||
    typeof opts.template !== 'string'
  ) {
    throw new Error('required opts: { projectName, projectDesc, template }')
  }

  const baseDir = path.resolve(path.join(__dirname, '..', '..'))

  const config = {
    projectName: opts.projectName,
    projectDesc: opts.projectDesc,
    baseDir,
    template: path.resolve(path.join(baseDir, 'templates', opts.template)),
    target: path.resolve(path.join(baseDir, 'packages', opts.projectName))
  }

  console.log(JSON.stringify(config, null, 2))

  try {
    fs.statSync(config.target)
    throw new Error('cannot create "' + config.target + '", does it already exists?')
  } catch (e) {
    if (e.errno !== -2 || e.code !== 'ENOENT') {
      throw e
    }
  }

  _recTplGen(config.template, config.target, config)
}

/**
 */
function _recTplGen (srcDir, destDir, config) {
  fs.mkdirSync(destDir)
  for (let f of fs.readdirSync(srcDir)) {
    const srcPart = path.join(srcDir, f)
    const destPart = path.join(destDir, f)
    const s = fs.statSync(srcPart)
    if (s.isFile()) {
      console.log('# template', destPart)
      const data = fs.readFileSync(srcPart).toString()
      const tpl = handlebars.compile(data)
      const res = tpl(config)
      fs.writeFileSync(destPart, res)
    } else if (s.isDirectory()) {
      _recTplGen(srcPart, destPart, config)
    } else {
      throw new Error('bad type: "' + srcPart + '"')
    }
  }
}

/**
 */
async function _genAllDocs () {
  let alldocs = `# documentation

## projects

`
  const baseDir = path.resolve(path.join(__dirname, '..', '..'))
  const projects = fs.readdirSync(path.join(baseDir, 'packages'))
  projects.sort()
  for (let project of projects) {
    const fn = path.join(baseDir, 'packages', project)
    if (!fs.lstatSync(fn).isDirectory()) {
      continue
    }
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

  const docDir = path.resolve(path.join(__dirname, '..', '..', 'docs'))

  const pkgJsonFile = path.resolve(path.join(dir, 'package.json'))
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonFile).toString())
  if (
    typeof pkgJson['generate-docs'] !== 'object' ||
    Object.keys(pkgJson['generate-docs']).length < 1
  ) {
    console.log('no docs listed for', dir)
    return
  }

  const projectDocDir = path.join(docDir, project)
  _assertDir(projectDocDir)

  const docs = pkgJson['generate-docs']
  const docKeys = Object.keys(docs)
  docKeys.sort()
  for (let docName of docKeys) {
    const docPath = path.join(dir, docs[docName])
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
