# n3h

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.net)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

## Overview
n3h delivers the networking component for [holochain-rust](https://github.com/holochain/holochain-rust).  This allows us to abstract away the complexity of p2p networking from the core Holochain functionality.

Currently it consists of an IPC API that connects holochain to a wrapper around the javascript ipfs implementation, or to a mock networking implementation.

## Monorepo
This top-level is just tools for helping manage the monorepo. Monorepo managed by [Lerna](https://www.npmjs.com/package/lerna)

To relieve some of the overhead of mananging node dependencies, putting all prototyping projects related to holochain networking / p2p in this single repository for now.

See the [API Documentation](docs/index.md)!

### Usage

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

### New projects

To create a new project, execute the following and fill out the prompts:

```shell
npm run new
```

## Contribute
Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contributing guidelines](https://github.com/holochain/org/blob/master/CONTRIBUTING.md) for our general practices and protocols on participating in the community.


## License
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

Copyright (C) 2019, Holochain Trust

This program is free software: you can redistribute it and/or modify it under the terms of the license p
rovided in the LICENSE file (GPLv3).  This program is distributed in the hope that it will be useful, bu
t WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 PURPOSE.

**Note:** We are considering other 'looser' licensing options (like MIT license) but at this stage are using GPL while we're getting the matter sorted out.  See [this article](https://medium.com/holochain/licensing-needs-for-truly-p2p-software-a3e0fa42be6c) for some of our thinking on licensing for distributed application frameworks.
