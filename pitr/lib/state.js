const defaultConfig = {
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
