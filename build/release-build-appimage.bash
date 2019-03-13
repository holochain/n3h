#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

VM_ARCH=${VM_ARCH:-unset}
if [ "$VM_ARCH" == "unset" ]; then
  VM_ARCH=$(uname -m)
  if [ "$VM_ARCH" == "x86_64" ]; then
    VM_ARCH="x64"
  fi
fi
export VM_ARCH=$VM_ARCH

function log() {
  echo "**release-build-appimage** ${@}"
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

# -- setup build directory -- #
BUILD_DIR=./appimage-build-$VM_ARCH
mkdir -p $BUILD_DIR
cd $BUILD_DIR

log "Building $VM_ARCH into $BUILD_DIR"

cp ../../package.json .
cp -a ../n3h.png .
cp -a ../../lib .

TC_BIN=""
function exec_dockcross() {
  TC_IMG_NAME="n3h-dockcross-linux-$VM_ARCH"
  cat > Dockerfile <<EOF
FROM dockcross/linux-$VM_ARCH

ENV DEFAULT_DOCKCROSS_IMAGE $TC_IMG_NAME
RUN apt-get update && apt-get install -y fuse
EOF
  docker build -t $TC_IMG_NAME .
  TC_BIN="dockcross-$VM_ARCH"
  docker run --rm --device /dev/fuse --cap-add SYS_ADMIN $TC_IMG_NAME > ./$TC_BIN
  chmod a+x ./$TC_BIN
  cp ../_release-build-appimage.bash .
  ./$TC_BIN -a "--device /dev/fuse --cap-add SYS_ADMIN" -- bash -c "VM_ARCH=$VM_ARCH ./_release-build-appimage.bash"
}

case "${VM_ARCH}" in
  "x86")
    exec_dockcross
    ;;
  "x64")
    exec_dockcross
    ;;
  "aarch64")
    VM_ARCH=$VM_ARCH ../vm-exec.bash ../_release-build-appimage.bash
    ;;
  *)
    log "ERROR, bad VM_ARCH: $VM_ARCH"
    exit 1
    ;;
esac

rm -rf output

tar xf output.tar.xz

echo "done."
