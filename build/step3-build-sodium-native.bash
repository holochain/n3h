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

# -- write our exec script -- #

cat > build-script-sodium-native.sh <<EOF
cd /work
export HOME="/work"
export PATH="/work:\$PATH"
node -p "'NODE ARCH: ' + require('os').arch()"
node npm/bin/npm-cli.js install --production sodium-native@2.3.0
EOF

# -- execute docker script -- #

log "execute docker build"
docker run --rm -it -v "$(pwd):/work" -u "$(id -u ${USER}):$(id -g ${USER})" \
  -e ARCH="${ARCH}" -e TGT_ARCH="${tgt_arch}" \
  "${docker_img}" /bin/sh /work/build-script-sodium-native.sh

# -- done -- #
log "done"
