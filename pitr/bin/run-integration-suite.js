#!/usr/bin/env node

const path = require('path')
const childProcess = require('child_process')

const { TestSuiteExecutor } = require('test-suite-executor')

async function main () {
  const n3hCmd = path.resolve(path.join(__dirname, 'n3h'))

  const exec = new TestSuiteExecutor()

  exec.on('spawnNode', node => {
    console.log('spawnNode', node.nodeName, node.nodeDir)

    const env = JSON.parse(JSON.stringify(process.env))
    env.N3H_WORK = node.nodeDir

    node.proc = childProcess.spawn(n3hCmd, {
      cwd: node.nodeDir,
      env,
      stdio: 'inherit'
    })

    node.proc.on('close', code => {
      console.log(node.nodeName, 'ended', code)
      if (code === 0) {
        node.resolve()
      } else {
        node.reject(new Error('exited with code ' + code))
      }
    })
  })

  exec.on('killNode', (node, resolve) => {
    console.log('killNode', node.nodeName)

    // node.proc.kill('SIGINT')
  })

  await exec.run()
}

main().then(() => {}, (err) => {
  console.error(err.stack || err.toString())
  process.exit(1)
})
