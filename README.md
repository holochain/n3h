# n3h

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.net)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

> **NB**: `n3h` is planned to be fully replaced with [`lib3h`](https://github.com/holochain/lib3h), and many parts of the Holochain codebase already use lib3h as of Nov 2019.

## Overview
`n3h` delivered the networking component for [holochain-rust](https://github.com/holochain/holochain-rust), however it is being superced by  Core Holochain functionality is sheltered from the complexity of low level p2p networking.

`n3h` does NOT need to be installed manually by Holochain users or developers. Holochain itself will download and install a pre-built version of `n3h` ready for use on your system, alleviating any concerns of version compatibility and mismatches.

> It did not previously work this way, `n3h` required separate manual installation prior to v0.0.12-alpha1 of `holochain-rust`.

## Versions

To see the archive of release versions and compatibility with Holochain core, please visit [release-versions.md](./release-versions.md).


## Usage

See the [API Documentation](docs/index.md)!

First, make sure our own dependencies are installed:

```shell
npm install
```

Now, to test:

```shell
npm test
```

## Contribute

Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contributing guidelines](https://github.com/holochain/org/blob/master/CONTRIBUTING.md) for our general practices and protocols on participating in the community.

## License
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Copyright (C) 2019, Holochain Trust

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
