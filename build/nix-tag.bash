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

mkdir -p "nix-tag"
cd "nix-tag"

# -- prepare project -- #
echo "*** preparing project ***"

mv ../../default.nix ../../default.nix~
rm -f ../../n3h.nix || true
rm -f ../../node-env.nix || true
rm -f ../../node-packages.nix || true
rm -rf ../../node_modules || true

# -- docker exec -- #
echo "*** execute node2nix in docker ***"

cat > Dockerfile <<EOF
FROM nixos/nix

RUN \
  nix-channel --add https://github.com/Holo-Host/nixpkgs-channels/archive/680f9d7ea90dd0b48b51f29899c3110196b0e913.tar.gz && \
  nix-channel --update && \
  nix-env -i bash && \
  nix-env -f '<nixpkgs>' -iA nodePackages.node2nix

RUN printf \
'#! /usr/bin/env bash\n'\
'cd /work\n'\
'node2nix -8 -i /work/package.json -l /work/package-lock.json --supplement-input /work/node-packages.json\n'\
'\n' \
> /nix-tag.bash
EOF

docker build -t "docker-n3h-nix-tag" .
docker run --rm -it \
  -v "$(pwd)/../..:/work" -u "$(id -u ${USER}):$(id -g ${USER})" \
  "docker-n3h-nix-tag" /usr/bin/env bash /nix-tag.bash

# -- finalize -- #
echo "*** finalize node2nix / cleanup ***"

mv ../../default.nix ../../n3h.nix
mv ../../default.nix~ ../../default.nix
sed -i.bak 's/inherit (pkgs) stdenv python2 utillinux runCommand writeTextFile;/inherit (pkgs)  python2 utillinux runCommand writeTextFile;\n    stdenv = pkgs.clangStdenv;/' ../../n3h.nix
rm ../../n3h.nix.bak

# -- done -- #
echo "done"
