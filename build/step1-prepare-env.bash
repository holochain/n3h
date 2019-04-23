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

# -- get more recent qemu-use-static binaries -- #

dl "${qemu_url}" "${qemu_file}" "${qemu_hash}"

log "extract debian archive"
( \
  mkdir -p ./qemu && \
  cd ./qemu && \
  ar x "../${qemu_file}" && \
  tar xf data.tar.xz \
)

# -- build docker image -- #

cat > Dockerfile <<EOF
FROM ${docker_from}

COPY ./qemu/usr/bin/${qemu_bin} /usr/bin/${qemu_bin}

RUN apt-get update && apt-get install -y --no-install-recommends \
  autoconf automake make cmake \
  g++ gcc patch python git libtool \
  ca-certificates wget curl \
  xxd desktop-file-utils pkg-config \
  libglib2.0-dev libcairo2-dev libfuse-dev \
  libarchive-dev zsync \
  && rm -rf /var/lib/apt/lists/*
EOF

docker build -t "${docker_img}" .

log "compressing docker image"
docker save "${docker_img}" | pxz -zT 0 > "${docker_img_file}"

# -- download pinned deps -- #

log "download pinned deps"
dl "${NPM_URL}" "${NPM_FILE}" "${NPM_HASH}"
tar xf "${NPM_FILE}"
dl "${NODE_URL}" "${NODE_FILE}" "${NODE_HASH}"
xz -dfk "${NODE_FILE}"
cp "$(basename ${NODE_FILE} .xz)" node
chmod a+x node

# -- appimagetool source -- #

log "get appimagetool source"
if [ ! -d AppImageKit ]; then
  git clone https://github.com/AppImage/AppImageKit.git
fi
(cd AppImageKit && git reset --hard)
(cd AppImageKit && git checkout ce61b83d8551bee46418156a6f197c3ee41f7e13)

# -- done -- #
log "done"
