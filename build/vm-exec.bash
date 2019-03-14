#!/bin/bash

# -- sane bash errors -- #
set -Eeuo pipefail

# -- helpers -- #

function log() {
  echo "vm-exec ${@}"
}

function twait() {
  local __timeout=${1}
  shift 1
  local __continue=1
  local __count=0
  local __success=0
  while [ $__continue -eq 1 ] && [ $__count -lt $__timeout ]; do
    sleep 1
    ((__count += 1))
    __continue=0
    "${@}" && __success=1 || __continue=1
  done
  if [ $__success -ne 1 ]; then
    exit 1
  fi
}

# -- temp dir && exit trap -- #
PID=""
TMPDIR=$(mktemp -d -t vm-exec.XXXXXXXXXX)
function cleanup() {
  rm -rf "$TMPDIR"
  log "finished"
}
trap cleanup EXIT

# -- variables -- #
VM_ARCH="${VM_ARCH:-aarch64}"
VM_TAG="${VM_TAG:-build}"
VM_TAG="${VM_ARCH}-${VM_TAG}"
VM_CMD="qemu-system-$VM_ARCH"
VM_MACHINE="virt"
VM_CPU="cortex-a57"
VM_USER="${VM_USER:-node-static-build}"
VM_IMAGE_DIR="${VM_IMAGE_DIR:-}"
VM_INTERACTIVE="${VM_INTERACTIVE:-}"
VM_IN_PLACE="${VM_IN_PLACE:-}"

log "$VM_TAG $VM_CMD $VM_MACHINE $VM_CPU"

# -- resolve symlinks in path -- #
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

MDIR=$DIR/machines-vm-exec
mkdir -p $MDIR

MADIR=$VM_IMAGE_DIR
if [ "x$MADIR" == "x" ]; then
  MADIR=$MDIR/$VM_TAG
fi
if [ ! -d $MADIR ]; then
  IMG_FILE=""
  IMG_URL=""
  IMG_HASH=""
  case "${VM_TAG}" in
    "aarch64-build")
      IMG_FILE="vm-debian-aarch64-build.tar.xz"
      IMG_URL="https://github.com/holochain/node-static-build/releases/download/deps-2019-03-12/vm-debian-aarch64-build.tar.xz"
      IMG_HASH="742893ca971a61232ab9af0452cac40c965d7f4d0c0e4d3597c644388b0e664c"
      ;;
    *)
      log "vm image ${VM_TAG} not yet supported"
      exit 1
      ;;
  esac
  mkdir -p $MADIR
  (
  cd $MADIR
  curl -L -O $IMG_URL
  echo "$IMG_HASH  $IMG_FILE" | sha256sum --check
  tar xf $IMG_FILE
  rm -f $IMG_FILE
  )
fi

IMG_DIR=$MADIR
if [ "x$VM_IN_PLACE" == "x" ]; then
  IMG_DIR=$TMPDIR
  log "copying image"
  cp -a $MADIR/* $TMPDIR/
fi

cat > $TMPDIR/insecure-key <<'EOF'
-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEA6NF8iallvQVp22WDkTkyrtvp9eWW6A8YVr+kz4TjGYe7gHzI
w+niNltGEFHzD8+v1I2YJ6oXevct1YeS0o9HZyN1Q9qgCgzUFtdOKLv6IedplqoP
kcmF0aYet2PkEDo3MlTBckFXPITAMzF8dJSIFo9D8HfdOV0IAdx4O7PtixWKn5y2
hMNG0zQPyUecp4pzC6kivAIhyfHilFR61RGL+GPXQ2MWZWFYbAGjyiYJnAmCP3NO
Td0jMZEnDkbUvxhMmBYSdETk1rRgm+R4LOzFUGaHqHDLKLX+FIPKcF96hrucXzcW
yLbIbEgE98OHlnVYCzRdK8jlqm8tehUc9c9WhQIBIwKCAQEA4iqWPJXtzZA68mKd
ELs4jJsdyky+ewdZeNds5tjcnHU5zUYE25K+ffJED9qUWICcLZDc81TGWjHyAqD1
Bw7XpgUwFgeUJwUlzQurAv+/ySnxiwuaGJfhFM1CaQHzfXphgVml+fZUvnJUTvzf
TK2Lg6EdbUE9TarUlBf/xPfuEhMSlIE5keb/Zz3/LUlRg8yDqz5w+QWVJ4utnKnK
iqwZN0mwpwU7YSyJhlT4YV1F3n4YjLswM5wJs2oqm0jssQu/BT0tyEXNDYBLEF4A
sClaWuSJ2kjq7KhrrYXzagqhnSei9ODYFShJu8UWVec3Ihb5ZXlzO6vdNQ1J9Xsf
4m+2ywKBgQD6qFxx/Rv9CNN96l/4rb14HKirC2o/orApiHmHDsURs5rUKDx0f9iP
cXN7S1uePXuJRK/5hsubaOCx3Owd2u9gD6Oq0CsMkE4CUSiJcYrMANtx54cGH7Rk
EjFZxK8xAv1ldELEyxrFqkbE4BKd8QOt414qjvTGyAK+OLD3M2QdCQKBgQDtx8pN
CAxR7yhHbIWT1AH66+XWN8bXq7l3RO/ukeaci98JfkbkxURZhtxV/HHuvUhnPLdX
3TwygPBYZFNo4pzVEhzWoTtnEtrFueKxyc3+LjZpuo+mBlQ6ORtfgkr9gBVphXZG
YEzkCD3lVdl8L4cw9BVpKrJCs1c5taGjDgdInQKBgHm/fVvv96bJxc9x1tffXAcj
3OVdUN0UgXNCSaf/3A/phbeBQe9xS+3mpc4r6qvx+iy69mNBeNZ0xOitIjpjBo2+
dBEjSBwLk5q5tJqHmy/jKMJL4n9ROlx93XS+njxgibTvU6Fp9w+NOFD/HvxB3Tcz
6+jJF85D5BNAG3DBMKBjAoGBAOAxZvgsKN+JuENXsST7F89Tck2iTcQIT8g5rwWC
P9Vt74yboe2kDT531w8+egz7nAmRBKNM751U/95P9t88EDacDI/Z2OwnuFQHCPDF
llYOUI+SpLJ6/vURRbHSnnn8a/XG+nzedGH5JGqEJNQsz+xT2axM0/W/CRknmGaJ
kda/AoGANWrLCz708y7VYgAtW2Uf1DPOIYMdvo6fxIB5i9ZfISgcJ/bbCUkFrhoH
+vq/5CIWxCPp0f85R4qxxQ5ihxJ0YDQT9Jpx4TMss4PSavPaBH3RXow5Ohe+bYoQ
NE5OgEXk2wVfZczCZpigBKbKZHNYcelXtTt/nP3rsCuGcM4h53s=
-----END RSA PRIVATE KEY-----
EOF
chmod 600 $TMPDIR/insecure-key

cat > $TMPDIR/ssh_config <<EOF
Host default
  Hostname 127.0.0.1
  User $VM_USER
  Port 2222
  IdentityFile $TMPDIR/insecure-key
  UserKnownHostsFile /dev/null
  StrictHostKeyChecking no
  ConnectionAttempts 1
  ConnectTimeout 2
EOF
chmod 600 $TMPDIR/ssh_config

VM_CMD="$VM_CMD -M $VM_MACHINE -cpu $VM_CPU -m 4G
    -initrd $IMG_DIR/initrd
    -kernel $IMG_DIR/linux
    -append 'root=/dev/sda2 console=ttyAMA0'
    -global virtio-blk-device.scsi=off
    -device virtio-scsi-device,id=scsi
    -drive file=$IMG_DIR/machine.qcow2,id=rootimg,cache=unsafe,if=none
    -device scsi-hd,drive=rootimg
    -device virtio-net-device,netdev=unet
    -netdev user,id=unet,hostfwd=tcp::2222-:22
    -nographic
    -monitor telnet::45454,server,nowait
    -serial mon:stdio"

if [ "x$VM_INTERACTIVE" != "x" ]; then
  eval $VM_CMD
  exit 0
fi

log $VM_CMD
eval $VM_CMD > $TMPDIR/log-vm-exec.log &
PID="$$"

log "vm booting ($PID), waiting for login"

twait 60 grep -q "node-static-build login:" $TMPDIR/log-vm-exec.log

log "login found, attempting ssh"

twait 10 ssh -F $TMPDIR/ssh_config default <<EOF
echo vm-exec able to log into vm!
EOF

if [ -f input.tar.xz ]; then
  scp -F $TMPDIR/ssh_config input.tar.xz default: || true
fi

EXEC_FILE=${1}
EXEC_FILE_NAME=$(basename ${1})

scp -F $TMPDIR/ssh_config ${EXEC_FILE} default: || true

# -- TODO - not sure why this errors, even when its contents all succeed -- #
(
ssh -F $TMPDIR/ssh_config default <<EOF
set -Eeuo pipefail
export VM_ARCH="${VM_ARCH}"
export VM_TAG="${VM_TAG}"
export VM_CMD="${VM_CMD}"
export VM_MACHINE="${VM_MACHINE}"
export VM_CPU="${VM_CPU}"
if [ -f input.tar.xz ]; then
  tar xf input.tar.xz
fi
echo ""
echo "-- vm-exec exec command --"
echo ""
(
./${EXEC_FILE_NAME}
) || true
exit 0
EOF
) || true

# -- make sure we still send the shutdown, even if this fails -- #
(
scp -F $TMPDIR/ssh_config default:output.tar.xz .
) || true

ssh -F $TMPDIR/ssh_config default <<EOF
echo ""
echo "-- vm-exec command complete, power down --"
echo ""
nohup sudo poweroff &>/dev/null &
exit 0
EOF

wait
