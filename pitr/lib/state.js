const defaultConfig = {
  '#persistence': 'config for how p2p info will be cached / persisted',
  persistence: {
    '#backend': 'settings for the backend persistence',
    backend: {
      '#type': 'backend type (only have sqlite3 for now)',
      type: 'sqlite3',
      '#config': 'backend specific configuration',
      config: {
        '#file': 'the sqlite3 file to use',
        file: 'n3h-persistence.sqlite3'
      }
    },
    '#cacheSize': 'how much data to keep in memory (default 20 MiB)',
    cacheSize: 1024 * 1024 * 20,
    '#dispatchTimeout': 'you probably don\'t need to change this',
    dispatchTimeout: 1000
  }
}

const state = {
  workDir: '/tmp',

  ipcUri: 'ipc:///tmp/n3h-ipc.socket',

  state: 'need_config',

  defaultConfig: JSON.stringify(defaultConfig, null, 2),

  config: defaultConfig
}

// export
for (let k in state) {
  exports[k] = state[k]
}
