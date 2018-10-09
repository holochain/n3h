const modules = require('../modules')
const { AsyncClass } = require('n3h-common')
const { HashCache } = require('hashcache')

class Persistence extends AsyncClass {
  constructor () {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._inst = null

      self.$pushDestructor(async () => {
        if (self._inst) {
          await self._inst.destroy()
        }
        self._inst = null
      })

      return self
    })
  }

  async getDefaultConfig () {
    return {
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

  async createInstance (config) {
    if (!this._inst) {
      this._inst = await new HashCache(config)
    }
    return this._inst
  }

  async initInstance () {
    if (!this._inst) {
      throw new Error('instance not yet created')
    }
    // no init needed for hashcache
  }
}

modules.registerModule('persistence', new Persistence())
