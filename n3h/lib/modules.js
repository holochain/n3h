const { AsyncClass } = require('n3h-common')
const state = require('./state')

/**
 */
class ModHelper extends AsyncClass {
  /**
   */
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

  /**
   */
  async registerModule (name, inst) {
    inst = await inst

    const defConfig = await inst.getDefaultConfig()

    state.defaultConfig = JSON.parse(state.defaultConfig)
    state.defaultConfig[name] = defConfig
    state.defaultConfig = JSON.stringify(state.defaultConfig, null, 2)
    state.config = JSON.parse(state.defaultConfig)

    this._modules.set(name, inst)
  }

  /**
   */
  async createModules () {
    if ('modules' in state) {
      throw new Error('modules already created')
    }

    const wait = []
    const out = state.modules = {}

    for (let [modName, modHelper] of this._modules) {
      wait.push(new Promise(async (resolve, reject) => {
        try {
          out[modName] = await modHelper.createInstance(state.config[modName])
          resolve()
        } catch (e) {
          reject(e)
        }
      }))
    }

    await Promise.all(wait)
  }

  /**
   */
  async injectModule (modName, modHelper) {
    state.modules[modName] = await modHelper.createInstance()
    this._modules.set(modName, modHelper)
  }

  /**
   */
  async initModules () {
    if (this._didInit) {
      throw new Error('modules already initialized')
    }
    this._didInit = true

    const wait = []
    for (let modHelper of this._modules.values()) {
      wait.push(modHelper.initInstance(state.modules))
    }
    await Promise.all(wait)
  }
}

let singletonPromise = null

/**
 */
function _getHelper () {
  if (singletonPromise) {
    return singletonPromise
  }
  singletonPromise = new ModHelper()
  return singletonPromise
}

const waitMods = []

/**
 */
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

/**
 */
exports.ready = function ready () {
  return Promise.all(waitMods)
}

/**
 */
exports.destroy = async function destroy () {
  (await _getHelper()).destroy()
}

/**
 */
exports.createModules = async function createModules () {
  await (await _getHelper()).createModules()
}

/**
 */
exports.injectModule = async function injectModule (modName, modHelper) {
  await (await _getHelper()).injectModule(modName, modHelper)
}

/**
 */
exports.initModules = async function initModules () {
  await (await _getHelper()).initModules()
}
