#!/bin/bash

set -Eeuo pipefail

docker run -h n3h-dev --rm -it holochain/n3h:n3h-dev "${@}"
