const { AsyncClass } = require('n3h-common')
const state = require('./state')

class ModHelper extends AsyncClass {
  constructor () {
    super()

    return AsyncClass.$construct(this, async (self) => {
      self._modules = new Map()

      self.$pushDestructor(async () => {
        const wait = []
        for (let v of self._modules.values()) {
          wait.push(v.destroy())
        }
        await Promise.all(wait)

        self._modules = null
      })

      return self
    })
  }

  async registerModule (name, inst) {
    inst = await inst

    const defConfig = await inst.getDefaultConfig()

    state.defaultConfig = JSON.parse(state.defaultConfig)
    state.defaultConfig[name] = defConfig
    state.defaultConfig = JSON.stringify(state.defaultConfig, null, 2)
    state.config = JSON.parse(state.defaultConfig)

    this._modules.set(name, inst)
  }

  async createModules () {
    const wait = []
    const destroy = []
    const out = {
      destroy: async () => {
        await Promise.all(destroy.map(fn => fn()))
      }
    }

    for (let [modName, modHelper] of this._modules) {
      wait.push(new Promise(async (resolve, reject) => {
        try {
          out[modName] = await modHelper.createInstance(state.config[modName])
          destroy.push(async () => {
            await out[modName].destroy()
          })
          resolve()
        } catch (e) {
          reject(e)
        }
      }))
    }

    await Promise.all(wait)

    return out
  }
}

let singletonPromise = null

function _getHelper () {
  if (singletonPromise) {
    return singletonPromise
  }
  singletonPromise = new ModHelper()
  return singletonPromise
}

const waitMods = []

exports.registerModule = function registerModule (name, inst) {
  waitMods.push(new Promise(async (resolve, reject) => {
    try {
      await (await _getHelper()).registerModule(name, inst)
      resolve()
    } catch (e) {
      reject(e)
    }
  }))
}

exports.ready = function ready () {
  return Promise.all(waitMods)
}

exports.destroy = async function destroy () {
  (await _getHelper()).destroy()
}

exports.createModules = async function createModules () {
  return (await _getHelper()).createModules()
}
