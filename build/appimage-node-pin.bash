#! /bin/bash
NPM_URL="https://github.com/holochain/node-static-build/releases/download/test-deploy-a12/node-v8.15.1-alpha8-npm.tar.xz"
NPM_FILE="node-v8.15.1-alpha8-npm.tar.xz"
NPM_HASH="969bfee6bd3371dd5f50824c33e206e297fc672d28fbed0146840ee8234b805a"
case "${tgt_arch}" in
  "ia32")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/test-deploy-a12/node-v8.15.1-alpha8-linux-ia32-partly-static.xz"
    NODE_FILE="node-v8.15.1-alpha8-linux-ia32-partly-static.xz"
    NODE_HASH="e0509aab6a36b8aaf0135b8101a124015903a697718ef4facf9334937107a863"
    ;;
  "x64")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/test-deploy-a12/node-v8.15.1-alpha8-linux-x64-partly-static.xz"
    NODE_FILE="node-v8.15.1-alpha8-linux-x64-partly-static.xz"
    NODE_HASH="203cf16b08fc3501cafa28ed4cb829956bfb7284ae684f7dbafc1126e8464f79"
    ;;
  "armv7l")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/test-deploy-a12/node-v8.15.1-alpha8-linux-armv7l-partly-static.xz"
    NODE_FILE="node-v8.15.1-alpha8-linux-armv7l-partly-static.xz"
    NODE_HASH="8f8852fa8a153f967fd6a07bc1ee435b4362451c3dc2361097bd86f06a4c5a2a"
    ;;
  "arm64")
    NODE_URL="https://github.com/holochain/node-static-build/releases/download/test-deploy-a12/node-v8.15.1-alpha8-linux-arm64-partly-static.xz"
    NODE_FILE="node-v8.15.1-alpha8-linux-arm64-partly-static.xz"
    NODE_HASH="04b078b452bdc06cda9caee03a1e3f2a2fae2b87bed271ca3a63a6081caeafe5"
    ;;
esac
