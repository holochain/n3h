#!/bin/bash

# -- sane bash errors -- #

set -Eeuo pipefail

# -- functions -- #

function log() {
  echo "**n3h-appimage-build** ${@}"
}

function dl() {
  local __url="${1}"
  local __file="${2}"
  local __hash="${3}"
  if [ ! -f "${__file}" ]; then
    curl -L -O "${__url}"
  fi
  log "${__file} hashes to $(sha256sum ${__file})"
  echo "${__hash}  ${__file}" | sha256sum --check
}

# -- resolve environment -- #

this_arch="$(uname -m)"

qemu_url=""
qemu_file=""
qemu_hash=""

case "${this_arch}" in
  "x86_64")
    qemu_url="http://ftp.us.debian.org/debian/pool/main/q/qemu/qemu-user-static_3.1+dfsg-8~deb10u1_amd64.deb"
    qemu_file="qemu-user-static_3.1+dfsg-8~deb10u1_amd64.deb"
    qemu_hash="244d9e69509bb9930716d7bb0873c1bd1afcd7cba62161a49ca0b6d99c93bec2"
    ;;
  *)
    log "ERROR, unsupported host arch ${this_arch}, supported hosts: x86_64"
    exit 1
    ;;
esac

tgt_arch="${TGT_ARCH:-unset}"

qemu_bin=""
docker_from=""

case "${tgt_arch}" in
  "ia32")
    qemu_bin="qemu-i386-static"
    docker_from="i386/debian:stretch-slim"
    export ARCH=i686 # <- appimage ARCH
    ;;
  "x64")
    qemu_bin="qemu-x86_64-static"
    docker_from="amd64/debian:stretch-slim"
    export ARCH=x86_64 # <- appimage ARCH
    ;;
  "arm")
    qemu_bin="qemu-arm-static"
    docker_from="arm32v7/debian:stretch-slim"
    export ARCH=arm # <- appimage ARCH
    ;;
  "arm64")
    qemu_bin="qemu-aarch64-static"
    docker_from="arm64v8/debian:stretch-slim"
    export ARCH=arm_aarch64 # <- appimage ARCH
    ;;
  *)
    log "ERROR, unsupported target arch ${tgt_arch}, supported targets: ia32, x64, arm, arm64"
    exit 1
    ;;
esac

docker_img="n3h-appimage-docker-${tgt_arch}"
docker_img_file="n3h-appimage-docker-${tgt_arch}.tar.xz"

# -- get our pinned urls / hashes -- #

source ./appimage-node-pin.bash

# -- setup build directory -- #

work_dir="$(pwd)/appimage-build-${tgt_arch}"
mkdir -p "${work_dir}"
cd "${work_dir}"

out_dir="$(pwd)/output"
mkdir -p "${out_dir}"

# -- release function -- #

function release() {
  __path="${1}"
  __file="$(basename "${__path}")"
  cp -af "${__path}" "${out_dir}/${__file}"
  (cd "${out_dir}" && sha256sum "${__file}" > "${__file}.sha256")
}
