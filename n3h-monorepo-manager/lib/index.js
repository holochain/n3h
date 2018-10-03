const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')
const jsdoc2md = require('jsdoc-to-markdown')

const handlebars = require('handlebars')

/**
 */
exports.install = async function install () {
  await _execAll('npm install')
}

/**
 */
exports.test = async function test () {
  await _execAll('npm test')
}

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
    pkgJson: path.resolve(path.join(baseDir, 'package.json')),
    template: path.resolve(path.join(baseDir, '_templates_', opts.template)),
    target: path.resolve(path.join(baseDir, opts.projectName))
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

  const pkg = JSON.parse(fs.readFileSync(
    config.pkgJson).toString())
  pkg.projects.push(config.projectName)
  fs.writeFileSync(config.pkgJson, JSON.stringify(pkg, null, 2))
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
async function _execAll (cmd) {
  const baseDir = path.resolve(path.join(__dirname, '..', '..'))
  const pkgJson = path.resolve(path.join(baseDir, 'package.json'))
  const projects = JSON.parse(fs.readFileSync(pkgJson).toString()).projects
  for (let project of projects) {
    await _execCmd(path.join(baseDir, project), cmd)
  }
}

/**
 */
function _execCmd (dir, cmd) {
  return new Promise((resolve, reject) => {
    try {
      const args = cmd.split(/\s+/)
      cmd = args.shift()
      console.log(dir, cmd, JSON.stringify(args))
      const proc = childProcess.spawn(cmd, args, {
        cwd: dir,
        shell: true,
        stdio: 'inherit'
      })
      proc.on('close', (code) => {
        if (code === 0) {
          return resolve()
        }
        reject(new Error('process exited ' + code))
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 */
async function _genAllDocs () {
  let alldocs = `# documentation

## projects

`
  const baseDir = path.resolve(path.join(__dirname, '..', '..'))
  const pkgJson = path.resolve(path.join(baseDir, 'package.json'))
  const projects = JSON.parse(fs.readFileSync(pkgJson).toString()).projects
  projects.sort()
  for (let project of projects) {
    const ret = await _genDocs(path.join(baseDir, project), project)
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
