# n3h

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.net)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Overview
n3h delivers the networking component for [holochain-rust](https://github.com/holochain/holochain-rust).  This allows us to abstract away the complexity of p2p networking from the core Holochain functionality.

Currently it consists of an IPC API that connects holochain to a wrapper around the javascript ipfs implementation, or to a mock networking implementation.

## Versions

Version 0.0.3 of Holochain was the first to use n3h as its networking component. For each version of the Holochain you must use the a compatible version of n3h.  Make sure to download the tagged release to download a version of n3h that is guaranteed to work with the equivalent Holochain version:

### 0.0.4
[https://github.com/holochain/n3h/releases/tag/v0.0.4-alpha1](https://github.com/holochain/n3h/releases/tag/v0.0.4-alpha1)
[https://github.com/holochain/holochain-rust/releases/tag/v0.0.4-alpha1](https://github.com/holochain/holochain-rust/releases/tag/v0.0.4-alpha1)

### 0.0.3
[https://github.com/holochain/n3h/releases/tag/v0.0.3](https://github.com/holochain/n3h/releases/tag/v0.0.3)
[https://github.com/holochain/holochain-rust/releases/tag/v0.0.3](https://github.com/holochain/holochain-rust/releases/tag/v0.0.3)


## Usage

See the [API Documentation](docs/index.md)!

First, make sure our own dependencies are installed:

```shell
npm install
```

Next, install all project dependencies (through lerna monorepo manager):

```shell
npm run bootstrap
```

Now, test all projects:

```shell
npm test
```

## Contribute

Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contributing guidelines](https://github.com/holochain/org/blob/master/CONTRIBUTING.md) for our general practices and protocols on participating in the community.

### Lerna

This monorepo is managed with the [Lerna](https://www.npmjs.com/package/lerna) helper tool.

### New projects

To create a new project, execute the following and fill out the prompts:

```shell
npm run new
```

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
