#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

# -- variables -- #
# TODO - update to node v10 after https://github.com/nodejs/node/issues/23440
NODE_SRC=node-v8.15.1
NODE_SRC_FILE=${NODE_SRC}.tar.gz
NODE_SRC_HASH=413e0086bd3abde2dfdd3a905c061a6188cc0faceb819768a53ca9c6422418b4
AIT_URL=https://github.com/AppImage/AppImageKit/releases/download/11/appimagetool-x86_64.AppImage
AIT_FILE=appimagetool-x86_64.AppImage
AIT_HASH=c13026b9ebaa20a17e7e0a4c818a901f0faba759801d8ceab3bb6007dde00372

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

# -- create package.json -- #
node -e "const p = require('../../package'); delete p.devDependencies; require('fs').writeFileSync('./AppDir/usr/bin/package.json', JSON.stringify(p, null, 2))"

# -- download nodejs source -- #
if [ ! -f $NODE_SRC_FILE ]; then
  curl -L -O https://nodejs.org/dist/latest-v8.x/$NODE_SRC_FILE
fi
echo "$NODE_SRC_HASH  $NODE_SRC_FILE" | sha256sum --check

# -- build node src -- #
if [ ! -f $NODE_SRC/build/usr/bin/node ]; then
  tar xf $NODE_SRC_FILE
  (cd $NODE_SRC && ./configure --prefix=/usr --enable-static --partly-static && make -j$(nproc) && DESTDIR=build make install)
fi

# -- copy in node executable -- #
cp $NODE_SRC/build/usr/bin/node ./AppDir/usr/bin/

# -- npm install -- #
# (make sure to use the node we just built)
(cd ./AppDir/usr/bin && ./node ../../../$NODE_SRC/build/usr/lib/node_modules/npm/bin/npm-cli.js install --production && ./node ../../../$NODE_SRC/build/usr/lib/node_modules/npm/bin/npm-cli.js prune)

# -- get appimagetool -- #
if [ ! -f $AIT_FILE ]; then
  curl -L -O $AIT_URL
fi
echo "$AIT_HASH  $AIT_FILE" | sha256sum --check
chmod a+x $AIT_FILE
ARCH=x86_64 ./$AIT_FILE ./AppDir n3h-0.0.1-linux-x86_64-minimal.AppImage

echo "done."
