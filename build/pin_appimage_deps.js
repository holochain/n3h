#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const https = require('https')
const { URL } = require('url')

if (!process.argv[2]) {
  throw new Error('required tag, usage: pin_appimage_deps.js node-static-build-tag')
}

const TAG = process.argv[2]

function fetch (url) {
  return new Promise((resolve, reject) => {
    try {
      url = new URL(url)
      console.log('fetch', url.toString(), url.hostname, url.pathname)
      https.get({
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 () AppleWebKit/537.36 (KHTML, like Gecko) NodeJs'
        }
      }, res => {
        if (res.statusCode === 302) {
          return resolve(fetch(res.headers.location))
        }
        let data = Buffer.alloc(0)
        res.on('data', chunk => {
          data = Buffer.concat([data, chunk])
        })
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error('bad status: ' + res.statusCode + ' ' + data.toString('utf8')))
          }
          resolve(data)
        })
      })
    } catch (e) {
      reject(e)
    }
  })
}

async function main () {
  const releaseInfo = JSON.parse((await fetch(`https://api.github.com/repos/holochain/node-static-build/releases/tags/${TAG}`)).toString('utf8'))

  const out = {
    npm: {},
    node: {
      ia32: {},
      x64: {},
      arm: {},
      arm64: {}
    }
  }

  for (let asset of releaseInfo.assets) {
    if (!asset.name.includes('npm') && !asset.name.includes('partly-static')) {
      continue
    }
    const m = asset.name.match(/^[^-]+-([^-]+)-([^-]+)-([^.]+)(.*)/)
    if (!m || m.length !== 5) {
      continue
    }

    if (m[3].includes('npm')) {
      if (m[4].includes('sha256')) {
        out.npm.hash = (await fetch(asset.browser_download_url)).toString().split(' ')[0]
      } else {
        out.npm.url = asset.browser_download_url
        out.npm.file = asset.name
      }
    } else {
      const mArch = m[3].match(/[^-]+-([^-]+)/)
      if (!mArch || mArch.length !== 2) {
        continue
      }
      if (m[4].includes('sha256')) {
        out.node[mArch[1]].hash = (await fetch(asset.browser_download_url)).toString().split(' ')[0]
      } else {
        out.node[mArch[1]].url = asset.browser_download_url
        out.node[mArch[1]].file = asset.name
      }
    }
  }

  let bash = '#! /bin/bash\n'

  const printBash = (p, o) => {
    bash += p + '_URL="' + o.url + '"\n'
    bash += p + '_FILE="' + o.file + '"\n'
    bash += p + '_HASH="' + o.hash + '"\n'
  }

  printBash('NPM', out.npm)
  bash += 'case "${tgt_arch}" in\n' // eslint-disable-line no-template-curly-in-string
  bash += '  "ia32")\n'
  printBash('    NODE', out.node.ia32)
  bash += '    ;;\n'
  bash += '  "x64")\n'
  printBash('    NODE', out.node.x64)
  bash += '    ;;\n'
  bash += '  "arm")\n'
  printBash('    NODE', out.node.arm)
  bash += '    ;;\n'
  bash += '  "arm64")\n'
  printBash('    NODE', out.node.arm64)
  bash += '    ;;\n'
  bash += 'esac\n'

  console.log('\n\n\n' + bash)

  const fn = path.resolve(__dirname, 'appimage-node-pin.bash')
  fs.writeFileSync(fn, bash)
}

main().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
