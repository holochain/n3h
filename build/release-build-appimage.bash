#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

# -- variables -- #
# TODO - update to node v10 after https://github.com/nodejs/node/issues/23440
NODE_URL=https://github.com/holochain/node-static-build/releases/download/alpha3/node-v8.15.1-linux-x86_64-alpha3
NODE_FILE=node-v8.15.1-linux-x86_64-alpha3
NODE_HASH=2fc0d3755e87844ec66330a03e4c0eb9898147845bf7d998a815f51f546f0a94
NPM_URL=https://github.com/holochain/node-static-build/releases/download/alpha3/npm-node-v8.15.1-alpha3.tar.xz
NPM_FILE=npm-node-v8.15.1-alpha3.tar.xz
NPM_HASH=1dea22d1dcbecd5b6ccd34cd7fe5b9df28f3881c5d330c2a67333b45258a9224
AIT_URL=https://github.com/AppImage/AppImageKit/releases/download/11/appimagetool-x86_64.AppImage
AIT_FILE=appimagetool-x86_64.AppImage
AIT_HASH=c13026b9ebaa20a17e7e0a4c818a901f0faba759801d8ceab3bb6007dde00372

ARCH=$(uname -m)

function dl {
  local __url="${1}"
  local __file="${2}"
  local __hash="${3}"
  if [ ! -f "${__file}" ]; then
    curl -L -O "${__url}"
  fi
  echo "${__hash}  ${__file}" | sha256sum --check
}

# -- resolve symlinks in path -- #
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

cd $DIR

BUILD_DIR=./appimage-build

# -- setup build directory -- #
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# -- download dependencies -- #
dl $NODE_URL $NODE_FILE $NODE_HASH
chmod a+x "$NODE_FILE"
dl $NPM_URL $NPM_FILE $NPM_HASH
tar xf $NPM_FILE
dl $AIT_URL $AIT_FILE $AIT_HASH
chmod a+x "$AIT_FILE"

# -- build the appdir directory -- #
mkdir -p AppDir
cat > ./AppDir/AppRun << EOF
#!/bin/sh
SELF=\$(readlink -f "\$0")
HERE=\${SELF%/*}
export PATH="\${HERE}/usr/bin/:\${HERE}/usr/sbin/:\${HERE}/usr/games/:\${HERE}/bin/:\${HERE}/sbin/\${PATH:+:\$PATH}"
export LD_LIBRARY_PATH="\${HERE}/usr/lib/:\${HERE}/usr/lib/i386-linux-gnu/:\${HERE}/usr/lib/x86_64-linux-gnu/:\${HERE}/usr/lib32/:\${HERE}/usr/lib64/:\${HERE}/lib/:\${HERE}/lib/i386-linux-gnu/:\${HERE}/lib/x86_64-linux-gnu/:\${HERE}/lib32/:\${HERE}/lib64/\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
export XDG_DATA_DIRS="\${HERE}/usr/share/\${XDG_DATA_DIRS:+:\$XDG_DATA_DIRS}"
exec "\${HERE}/usr/bin/node" "\${HERE}/usr/bin/n3h.js" "\$@"
EOF
chmod a+x ./AppDir/AppRun
mkdir -p ./AppDir/usr/share/applications
cat > ./AppDir/usr/share/applications/n3h.desktop << EOF
[Desktop Entry]
Categories=Utility;
Type=Application
Exec=n3h
Icon=n3h
Name=n3h
Terminal=true
EOF
ln -f -s usr/share/applications/n3h.desktop ./AppDir/n3h.desktop
mkdir -p ./AppDir/usr/share/icons/hicolor/32x32/apps
cp -a ../n3h.png ./AppDir/usr/share/icons/hicolor/32x32/apps/
ln -f -s usr/share/icons/hicolor/32x32/apps/n3h.png ./AppDir/n3h.png
mkdir -p ./AppDir/usr/bin
rm -rf ./AppDir/usr/bin/lib
cp -a ../../lib ./AppDir/usr/bin/
cat > ./AppDir/usr/bin/n3h.js << EOF
const { main } = require('./lib/exe')

main().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
EOF

# -- copy in node executable -- #
cp $NODE_FILE ./AppDir/usr/bin/node

# -- create package.json -- #
./AppDir/usr/bin/node -e "const p = require('../../package'); delete p.devDependencies; require('fs').writeFileSync('./AppDir/usr/bin/package.json', JSON.stringify(p, null, 2))"
PLATFORM=$(./AppDir/usr/bin/node -e "console.log(require('os').platform())")
VERSION=$(./AppDir/usr/bin/node -e "console.log(require('../../package').version)")

# -- npm install -- #
# (make sure to use the node we just built)
(cd ./AppDir/usr/bin && ./node ../../../npm/bin/npm-cli.js install --production && ./node ../../../npm/bin/npm-cli.js prune)

# -- build with appimagetool -- #
OUTPUT=n3h-$VERSION-$PLATFORM-$ARCH-minimal.AppImage
ARCH=$ARCH ./$AIT_FILE ./AppDir $OUTPUT
sha256sum $OUTPUT > $OUTPUT.sha256

echo "done."
