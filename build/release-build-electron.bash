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
npm install --save-dev electron@4.0.7 electron-builder@20.38.5
npm prune

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
  "artifactName": "\${productName}-\${version}-\${os}-x64.\${ext}",
  "mac": {
    "target": "tar.gz"
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

./node_modules/.bin/electron-builder --config electron-builder.json --publish never "${@}"
(cd dist && for i in $(ls n3h*.AppImage n3h*.dmg n3h*.exe 2> /dev/null); do sha256sum $i > "${i}.sha256" || shasum -a 256 $i > "${i}.sha256"; done)
rm -f dist/*.blockmap

echo "done."
