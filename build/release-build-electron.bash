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

BUILD_DIR=./electron-build

# -- setup build directory -- #
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# -- copy in the source -- #
rm -rf ./lib
cp -a ../../lib .

# -- create package.json -- #
node -e "const p = require('../../package'); delete p.devDependencies; p.main = 'electron.js'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2))"

npm install
npm install --save-dev electron electron-builder

# -- create electron.js -- #
cat > ./electron.js << EOF
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

# -- create electron-builder.json config file -- #
cat > ./electron-builder.json << EOF
{
  "productName": "n3h",
  "artifactName": "\${productName}-\${version}-\${os}-\${arch}.\${ext}",
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": "AppImage"
  },
  "win": {
    "target": "portable"
  },
  "appImage": {
    "systemIntegration": "doNotAsk"
  }
}
EOF

./node_modules/.bin/electron-builder --config electron-builder.json

echo "done."
