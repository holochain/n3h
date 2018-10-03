# n3h-monorepo-manager

This top-level is just tools for helping manage the monorepo.

To relieve some of the overhead of mananging node dependencies, putting all prototyping projects related to holochain networking / p2p in this single repository for now.

See the [Documentation](docs/index.md)!

### Usage

First, make sure our own dependencies are installed:

```shell
npm install
```

Next, install all project dependencies:

```shell
npm run install-all
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
