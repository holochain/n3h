#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

# -- resolve symlinks in path -- #
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

cd $DIR

# -- setup build directory -- #
rm -Rf build
mkdir -p build

# -- create package.json -- #
cat > build/package.json << EOF
{
  "name": "@holochain/n3h",
  "version": "0.0.1",
  "description": "nodejs holochain networking library with swapable / configurable modules",
  "main": "electron.js",
  "license": "Apache-2.0",
  "devDependencies": {
    "electron": "^4.0.6",
    "electron-builder": "^20.38.5"
  },
  "dependencies": {
    "@holochain/n-bch-rs": "^0.0.4",
    "bip39": "^2.5.0",
    "bs58": "^4.0.1",
    "sodium-native": "^2.2.3",
    "express": "^4.16.4",
    "express-ws": "^4.0.0",
    "helmet": "^3.15.0",
    "msgpack-lite": "^0.1.26",
    "node-forge": "^0.7.6",
    "ws": "^6.1.2"
  },
  "build": {
    "productName": "n3h",
    "artifactName": "\${productName}-\${version}.\${ext}",
    "linux": {
      "target": "AppImage"
    },
    "appImage": {
      "systemIntegration": "doNotAsk"
    }
  }
}
EOF

(cd build && npm install)

# -- create electron.js -- #
cat > build/electron.js << EOF
const { app } = require('electron')
app.disableHardwareAcceleration()

const { main } = require('./lib/exe')

app.on('ready', () => {
  main().then(() => {}, err => {
    console.error(err)
    process.exit(1)
  })
})
EOF

mkdir -p ./build/lib
cp -a ./packages/n3h/lib/*.js ./build/lib/
sed -i.bak "s/require('@holochain/require('./g" ./build/lib/*.js

function import {
  local _path="${1}"
  local _src="./packages/${_path}/lib/*.js"
  local _dst="./build/lib/${_path}"
  mkdir -p ${_dst}
  cp -a ${_src} ${_dst}
  sed -i.bak "s/require('@holochain/require('../g" ${_dst}/*.js
  sed -i.bak "s/..\/n-bch-rs/@holochain\/n-bch-rs/g" ${_dst}/*.js
}

import mosodium
import hc-dpki
import tweetlog
import n3h-common
import hackmode
import n3h-mod-spec
import n3h-mod-connection-wss
import n3h-mod-dht-fullsync

(cd build && ./node_modules/.bin/electron-builder)

echo "done."
