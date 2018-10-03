#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')

const msgpack = require('msgpack-lite')

const { IpcClient } = require('node-p2p-ipc')

function _sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function _spawnP2p (sockName, connectTo, disp) {
  const fn = path.resolve(path.join(__dirname, '_chat_p2p.js'))
  disp('spawn ' + fn)

  const args = [fn, sockName]
  connectTo && args.push(connectTo)
  const proc = childProcess.spawn('node', args)

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(e => {
      e && disp(e)
    })
  })

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').forEach(e => {
      e && disp(e)
    })
  })

  proc.on('close', (code) => {
    disp('exited ' + code)
    process.exit(1)
  })

  return proc
}

async function _main () {
  let connectTo = null
  if (process.argv.length > 2) {
    connectTo = process.argv[2]
  }

  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  process.stdin.setRawMode(true)

  const sockName = Math.random().toString(36).replace(/\./g, '')
  const ipcSocket = './' + sockName + '.ipc.sock'

  let line = ''

  const disp = (...args) => {
    process.stdout.write('\u001B[2K\r')
    args.length && console.log(...args)
    process.stdout.write('c3hat> ' + line)
  }

  const clean = () => {
    process.stdin.removeListener('data', getc)
    process.stdin.setRawMode(false)
    process.stdin.pause()
  }

  const handleTerm = () => {
    clean()
    try {
      p2pProc.kill()
    } catch (e) { /* pass */ }
    try {
      client.close()
    } catch (e) { /* pass */ }
    try {
      fs.unlinkSync(ipcSocket)
    } catch (e) { /* pass */ }
    console.log('\nc3hat done')

    process.exit(0)
  }

  process.on('SIGINT', handleTerm)
  process.on('SIGTERM', handleTerm)
  process.on('exit', handleTerm)
  process.on('uncaughtException', e => {
    console.error(e.stack || e.toString())
    handleTerm()
  })

  const getc = (c) => {
    switch (c) {
      case '\r':
      case '\n':
        const tmp = line
        line = ''
        disp('\n' + name + ': ' + tmp)
        ipcMsg('message', tmp).then(() => {}, (err) => {
          console.error(err)
          process.exit(1)
        })
        break
      case '\u0004':
      case '\u0003':
        handleTerm()
        break
      default:
        if (c.charCodeAt(0) === 127) {
          line = line.substr(0, line.length - 1)
          disp()
        } else {
          line += c
          disp()
        }
        break
    }
  }

  const p2pProc = _spawnP2p(sockName, connectTo, (txt) => {
    disp('@p2p@ ' + txt)
  })

  // give p2p a chance to gen keys, etc
  await _sleep(2000)

  const client = new IpcClient()
  await client.connect('ipc://' + ipcSocket)

  const ipcMsg = async (type, data) => {
    const resp = await client.call(
      msgpack.encode({ type, data }))
    if (!resp) {
      console.error('bad ipc response', resp)
      process.exit(1)
    }
    if (resp.byteLength) {
      return msgpack.decode(resp)
    }
  }

  const name = await ipcMsg('getName')
  disp('\nTHIS NAME:', name)

  client.on('call', (opt) => {
    const msg = msgpack.decode(opt.data)
    disp('\n' + msg.data.from + ': ' + msg.data.msg)
    opt.resolve(Buffer.alloc(0))
  })

  process.stdin.on('data', getc)
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
