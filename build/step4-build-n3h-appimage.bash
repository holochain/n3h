#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

# -- resolve symlinks in path -- #

src_dir="${BASH_SOURCE[0]}"
while [ -h "${src_dir}" ]; do
  work_dir="$(cd -P "$(dirname "${src_dir}")" >/dev/null 2>&1 && pwd)"
  src_dir="$(readlink "${src_dir}")"
  [[ ${src_dir} != /* ]] && src_dir="${work_dir}/${src_dir}"
done
work_dir="$(cd -P "$(dirname "${src_dir}")" >/dev/null 2>&1 && pwd)"

cd "${work_dir}"

# -- common code -- #

source ./common.bash

# -- load our docker image -- #

log "load docker image"
pxz -dc "${docker_img_file}" | docker load

# -- prep our appdir -- #

log "prep AppDir"
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
mkdir -p ./AppDir/usr/bin/node_modules
cp -a node_modules/sodium-native ./AppDir/usr/bin/node_modules
rm -rf ./AppDir/usr/bin/lib
cp -a ../../lib ./AppDir/usr/bin/
cp -a ../../package.json .
cat > ./AppDir/usr/bin/n3h.js <<EOF
const { main } = require('./lib/exe')

main().then(() => {}, err => {
  console.error(err)
  process.exit(1)
})
EOF
cp node ./AppDir/usr/bin/node

# -- write our exec script -- #

cat > build-script-sodium-native.sh <<EOF
cd /work
export HOME="/work"
export PATH="/work/AppDir/usr/bin:\$PATH"
node -e "const p = require('./package'); delete p.devDependencies; require('fs').writeFileSync('./AppDir/usr/bin/package.json', JSON.stringify(p, null, 2))"
export VERSION="\$(node -e "console.log(require('./package').version)")"
echo "\$VERSION" > version
sh -c 'while [ true ]; do sleep 60; echo "tick - still running npm install"; done' &
PID="\${!}"
(cd ./AppDir/usr/bin && node ../../../npm/bin/npm-cli.js install --production --prune)
kill "\${PID}"
PNAME="n3h-\${VERSION}-linux-\${TGT_ARCH}"
ONAME="\${PNAME}.AppImage"
./AppImageKit/build/install_prefix/usr/bin/appimagetool ./AppDir "./\${ONAME}"
echo "{}" | NO_CLEANUP=1 /usr/bin/${qemu_bin} "./\${ONAME}" --appimage-extract-and-run --smoke
EOF

# -- execute docker script -- #

log "execute docker build"
docker run --rm -it -v "$(pwd):/work" -u "$(id -u ${USER}):$(id -g ${USER})" \
  -e ARCH="${ARCH}" -e TGT_ARCH="${tgt_arch}" \
  "${docker_img}" /bin/sh /work/build-script-sodium-native.sh

# -- package up release -- #

PNAME="n3h-$(cat version)-linux-${tgt_arch}"
ONAME="${PNAME}.AppImage"
log "package release"
release "${ONAME}"

mkdir -p ./$PNAME
cp -a ./AppDir/usr/bin/node ./$PNAME
cp -a ./AppDir/usr/bin/n3h.js ./$PNAME
cp -a ./AppDir/usr/bin/package.json ./$PNAME
cp -a ./AppDir/usr/bin/lib ./$PNAME
cp -a ./AppDir/usr/bin/node_modules ./$PNAME
cp -a ../n3h-nix.bash ./$PNAME
BNAME="${PNAME}.tar.gz"
tar -czf "${BNAME}" "${PNAME}"
release "${BNAME}"

# -- done -- #
log "done"
