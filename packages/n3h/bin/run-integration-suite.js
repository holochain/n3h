#!/usr/bin/env node

const path = require('path')
const childProcess = require('child_process')

const { TestSuiteExecutor } = require('@holochain/test-suite-executor')

async function main () {
  const n3hCmd = path.resolve(path.join(__dirname, 'n3h'))

  const exec = await new TestSuiteExecutor()

  exec.on('spawnNode', node => {
    console.log('spawnNode', node.name, node.dir)

    const env = JSON.parse(JSON.stringify(process.env))
    env.N3H_WORK_DIR = node.dir
    env.N3H_IPC_SOCKET = node.ipcUri

    return new Promise(async (resolve, reject) => {
      try {
        node.proc = childProcess.spawn(n3hCmd, {
          cwd: node.dir,
          env
        })

        let procOutput = ''
        let resolved = false
        node.proc.stdout.on('data', (chunk) => {
          process.stdout.write(chunk)
          if (!resolved) {
            procOutput += chunk.toString()
            if (procOutput.indexOf('#IPC-READY#') > -1) {
              procOutput = null
              resolved = true
              resolve()
            }
          }
        })

        node.proc.stderr.on('data', (chunk) => {
          process.stderr.write(chunk)
        })

        node.proc.on('close', code => {
          console.log(node.name, 'ended', code)
          if (code === 0) {
            node.resolve()
          } else {
            node.reject(new Error('exited with code ' + code))
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  })

  exec.on('killNode', (node, resolve) => {
    node.proc.kill('SIGINT')
  })

  let terminated = false
  const terminate = async () => {
    if (terminated) {
      return
    }
    try {
      await exec.destroy()
      console.log('run-integration-suite exited cleanly')
      process.exit(0)
    } catch (e) {
      console.error(e.stack || e.toString())
      process.exit(1)
    }
  }

  process.on('SIGINT', terminate)
  process.on('SIGTERM', terminate)

  exec.on('done', async () => {
    await terminate()
  })

  await exec.run()
}

main().then(() => {}, (err) => {
  console.error(err.stack || err.toString())
  process.exit(1)
})
