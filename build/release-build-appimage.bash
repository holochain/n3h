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
tar -cJf input.tar.xz package.json n3h.png lib

TC_BIN=""
function exec_dockcross() {
  DOCKCROSS_ARCH="${1}"
  DOCKCROSS_CMD="${2}"
  TC_IMG_NAME="n3h-dockcross-linux-$DOCKCROSS_ARCH"
  cat > Dockerfile <<EOF
FROM dockcross/linux-$DOCKCROSS_ARCH

ENV DEFAULT_DOCKCROSS_IMAGE $TC_IMG_NAME

RUN printf \
'deb http://cdn-fastly.deb.debian.org/debian/ jessie main\n'\
'deb-src http://cdn-fastly.deb.debian.org/debian/ jessie main\n'\
'\n'\
'deb http://security.debian.org/ jessie/updates main\n'\
'deb-src http://security.debian.org/ jessie/updates main\n'\
'\n'\
'deb http://archive.debian.org/debian jessie-backports main\n'\
'deb-src http://archive.debian.org/debian jessie-backports main\n'\
> /etc/apt/sources.list

RUN echo 'Acquire::Check-Valid-Until "false";' >> /etc/apt/apt.conf

RUN apt-get update && apt-get install -y fuse qemu-system-aarch64
EOF
  docker build -t $TC_IMG_NAME .
  TC_BIN="dockcross-$DOCKCROSS_ARCH"
  docker run -p 2222:2222 --rm --device /dev/fuse --cap-add SYS_ADMIN $TC_IMG_NAME > ./$TC_BIN
  chmod a+x ./$TC_BIN
  ./$TC_BIN -a "-p 2222:2222 --device /dev/fuse --cap-add SYS_ADMIN" -- bash -c "$DOCKCROSS_CMD"
}

function exec_qemu() {
  DOCKER_CMD="${1}"
  TC_IMG_NAME="n3h-qemu"
  cat > Dockerfile <<EOF
FROM debian:sid

RUN apt-get update && apt-get install -y --no-install-recommends \
  qemu-system-aarch64 qemu-utils xz-utils ca-certificates curl ssh
EOF
  docker build -t $TC_IMG_NAME .
  docker run -it -v "$PWD":/work -p 2222:2222 --rm $TC_IMG_NAME bash -c "$DOCKER_CMD"
}

cp ../_release-build-appimage.bash .
cp ../vm-exec.bash .

case "${VM_ARCH}" in
  "x86")
    exec_dockcross $VM_ARCH "VM_ARCH=$VM_ARCH ./_release-build-appimage.bash"
    ;;
  "x64")
    exec_dockcross $VM_ARCH "VM_ARCH=$VM_ARCH ./_release-build-appimage.bash"
    ;;
  "aarch64")
    exec_qemu "cd /work && VM_ARCH=$VM_ARCH ./vm-exec.bash ./_release-build-appimage.bash"
    ;;
  *)
    log "ERROR, bad VM_ARCH: $VM_ARCH"
    exit 1
    ;;
esac

rm -rf output

tar xf output.tar.xz

log "done"
