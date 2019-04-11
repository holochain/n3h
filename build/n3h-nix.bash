#! /usr/bin/env nix-shell
#! nix-shell -i bash -p bash glibc gcc coreutils which
SOURCE="${BASH_SOURCE[0]}"
while [ -h "${SOURCE}" ]; do
  DIR="$(cd -P "$(dirname "${SOURCE}")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "${SOURCE}")"
  [[ ${SOURCE} != /* ]] && SOURCE="${DIR}/${SOURCE}"
done
DIR="$(cd -P "$(dirname "${SOURCE}")" >/dev/null 2>&1 && pwd)"
GCC="$(which gcc)"
GLIBC_LIB="$(nix-store --query --requisites "${GCC}" | grep 'glibc-[[:digit:]]\+\.[[:digit:]]\+$' | head -1)/lib"
GCC_LIB="$(nix-store --query --requisites "${GCC}" | grep 'gcc-[[:digit:]]\+\.[[:digit:]]\+\.[[:digit:]]\+-lib$' | head -1)/lib"
LD_BIN="$(find "${GLIBC_LIB}" -name "ld-linux*.so*" | head -1)"
export LD_LIBRARY_PATH="${GLIBC_LIB}:${GCC_LIB}"
exec "${LD_BIN}" "${DIR}/node" "${DIR}/n3h.js" "$@"
