#!/bin/bash

set -Eeuo pipefail

(cd .. && git archive --prefix n3h/ --format tar --output docker/n3h.tar HEAD)
docker build -f Dockerfile.stretch -t holochain/n3h:n3h-dev .
