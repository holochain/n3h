#!/usr/bin/env node

const crypto = require('crypto')
const path = require('path')
const childProcess = require('child_process')

const { Node } = require('../../lib/node')

function _spawn_p2p (name, disp) {
  const fn = path.resolve(path.join(__dirname, '_c3hat_p2p.js'))
  disp('spawn ' + fn)

  const proc = childProcess.spawn('node', [fn, name])

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(e => {
      e && disp(e + '\n')
    })
  })

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').forEach(e => {
      e && disp(e + '\n')
    })
  })

  proc.on('close', (code) => {
    disp('exited ' + code)
    process.exit(1)
  })
}

async function _main () {
  process.stdin.setEncoding('utf8')
  process.stdin.resume()
  process.stdin.setRawMode(true)

  const name = Node._friend(crypto.randomBytes(4))
  console.log('my name: ' + name)

  let line = ''

  const disp = (txt) => {
    process.stdout.write('\u001B[2K\r')
    if (txt) process.stdout.write(txt)
    process.stdout.write('c3hat> ' + line)
  }

  const clean = () => {
    process.stdin.removeListener('data', getc)
    process.stdin.setRawMode(false)
    process.stdin.pause()
  }

  const handleTerm = () => {
    clean()
    console.log('\nc3hat done')
    process.exit(0)
  }

  process.on('SIGINT', handleTerm)
  process.on('SIGTERM', handleTerm)

  const getc = (c) => {
    switch (c) {
      case '\r':
      case '\n':
        const tmp = line
        line = ''
        disp('\n' + name + ': ' + tmp + '\n')
        break
      case '\u0004':
      case '\u0003':
        handleTerm()
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

  disp()
  process.stdin.on('data', getc)

  _spawn_p2p(name, (txt) => {
    disp('@p2p@ ' + txt)
  })
}

_main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
