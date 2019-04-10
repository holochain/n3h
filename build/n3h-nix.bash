#! /usr/bin/env nix-shell
#! nix-shell -i bash -p bash glibc gcc coreutils
SOURCE="${BASH_SOURCE[0]}"
while [ -h "${SOURCE}" ]; do
  DIR="$(cd -P "$(dirname "${SOURCE}")" >/dev/null 2>&1 && pwd)"
  SOURCE="$(readlink "${SOURCE}")"
  [[ ${SOURCE} != /* ]] && SOURCE="${DIR}/${SOURCE}"
done
DIR="$(cd -P "$(dirname "${SOURCE}")" >/dev/null 2>&1 && pwd)"
cd "${DIR}"
GCC="$(which gcc)"
GLIBC_LIB="$(nix-store --query --requisites "${GCC}" | grep 'glibc-[[:digit:]]\+\.[[:digit:]]\+$' | head -1)/lib"
GCC_LIB="$(nix-store --query --requisites "${GCC}" | grep 'gcc-[[:digit:]]\+\.[[:digit:]]\+\.[[:digit:]]\+-lib$' | head -1)/lib"
LD_BIN="$(find "${GLIBC_LIB}" -name "ld-linux*.so*" | head -1)"
export LD_LIBRARY_PATH="${GLIBC_LIB}:${GCC_LIB}"
echo "GLIBC_LIB: ${GLIBC_LIB}"
echo "GCC_LIB: ${GCC_LIB}"
echo "LD_BIN: ${LD_BIN}"
echo "LD_LIBRARY_PATH: ${LD_LIBRARY_PATH}"
exec "${LD_BIN}" ./node ./n3h.js "$@"
