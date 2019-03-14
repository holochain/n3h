#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

function log() {
  echo "--_release-build-appimage-- ${@}"
}

# -- variables -- #
NPM_URL=https://github.com/holochain/node-static-build/releases/download/deps-2019-03-12/npm-node-v8.15.1-alpha6.tar.xz
NPM_FILE=npm-node-v8.15.1-alpha6.tar.xz
NPM_HASH=8c097108fc1a31eb1d370d03aeae72a85d3440149698bea394e1de702c1e6c7e

NODE_URL=""; NODE_FILE=""; NODE_HASH=""
AIT_URL=""; AIT_FILE=""; AIT_HASH=""

case "$VM_ARCH" in
  "x86")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/deps-2019-03-12/node-v8.15.1-linux-x86-alpha6"
    NODE_FILE="node-v8.15.1-linux-x86-alpha6"
    NODE_HASH="fd82092e3a1f3980f0711ae5e74d1d3120ec807be489cfb972b2718ee0ed9e0d"
    AIT_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-i686.AppImage"
    AIT_FILE="appimagetool-i686.AppImage"
    AIT_HASH="61860573ccfafc4d5ad5bbf6d8173833acd2be9472a79d48a160fee4bb3c3b8d"
    ;;
  "x64")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/deps-2019-03-12/node-v8.15.1-linux-x64-alpha6"
    NODE_FILE="node-v8.15.1-linux-x64-alpha6"
    NODE_HASH="1e31b2e916608218e09ef9ef9dc48eba0cc58557225f8d81020b7e1b33144cef"
    AIT_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    AIT_FILE="appimagetool-x86_64.AppImage"
    AIT_HASH="ca10294b1b165aa60bb2aab604f84c38799c28e20b4db334efe27f72d7111516"
    ;;
  "aarch64")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/deps-2019-03-12/node-v8.15.1-linux-aarch64-alpha6"
    NODE_FILE="node-v8.15.1-linux-aarch64-alpha6"
    NODE_HASH="1ee7bf536272410977581316565a65fbc8cedfa420a9b595978a68c557c37075"
    AIT_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-aarch64.AppImage"
    AIT_FILE="appimagetool-aarch64.AppImage"
    AIT_HASH="8c4e4fd4627ab302c1aba589927fb6a3ae97fa50a9f79833c928674a8c20439f"
    ;;
  *)
    log "VM_ARCH $VM_ARCH not yet supported"
    exit 1
    ;;
esac

function dl {
  local __url="${1}"
  local __file="${2}"
  local __hash="${3}"
  if [ ! -f "${__file}" ]; then
    curl -L -O "${__url}"
  fi
  echo "${__file} hashes to $(sha256sum ${__file})"
  echo "${__hash}  ${__file}" | sha256sum --check
}

# -- download dependencies -- #
log "downloading dependencies"

dl "$NODE_URL" "$NODE_FILE" "$NODE_HASH"
chmod a+x "$NODE_FILE"
dl "$NPM_URL" "$NPM_FILE" "$NPM_HASH"
tar xf $NPM_FILE
dl "$AIT_URL" "$AIT_FILE" "$AIT_HASH"
chmod a+x "$AIT_FILE"

# -- build the appdir directory -- #
log "building AppDir"

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
pwd
cp -a n3h.png ./AppDir/usr/share/icons/hicolor/32x32/apps/
ln -f -s usr/share/icons/hicolor/32x32/apps/n3h.png ./AppDir/n3h.png
mkdir -p ./AppDir/usr/bin
rm -rf ./AppDir/usr/bin/lib
cp -a lib ./AppDir/usr/bin/
cat > ./AppDir/usr/bin/n3h.js << EOF
const { main } = require('./lib/exe')

main().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
EOF

# -- copy in node executable -- #
cp $NODE_FILE ./AppDir/usr/bin/node
# (make sure to use the node we just built)
export PATH=$(pwd)/AppDir/usr/bin:$PATH

# -- create package.json -- #
log "installing node dependencies"

node -e "const p = require('./package'); delete p.devDependencies; require('fs').writeFileSync('./AppDir/usr/bin/package.json', JSON.stringify(p, null, 2))"
VERSION=$(node -e "console.log(require('./package').version)")

# -- npm install -- #
case "$VM_ARCH" in
  "x86")
    export ARCH=x86
    ;;
  "x64")
    export ARCH=x86_64
    ;;
  "aarch64")
    export ARCH=aarch64
    dl https://github.com/holochain/node-static-build/releases/download/deps-2019-03-12/sodium-native-2.3.0-aarch64.tar.xz sodium-native-2.3.0-aarch64.tar.xz 017c395ab0404b455f59cf13ffd1a33faba2276e4d04d38db9775659f592e449
    mkdir -p ./AppDir/usr/bin/node_modules
    (cd ./AppDir/usr/bin/node_modules && tar xf ../../../../sodium-native-2.3.0-aarch64.tar.xz && rm -rf sodium-native/prebuilds)
    # preseed our prebuilt sodium
    ;;
esac

(cd ./AppDir/usr/bin && node ../../../npm/bin/npm-cli.js install --production --prune)

# -- build with appimagetool -- #
log "generate AppImage"

mkdir -p ./output
ONAME=n3h-$VERSION-linux-$VM_ARCH.AppImage
./$AIT_FILE ./AppDir ./output/$ONAME
(cd ./output && sha256sum $ONAME > $ONAME.sha256)

log "package output"
tar -cJf output.tar.xz ./output

log "done"
