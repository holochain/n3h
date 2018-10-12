const { AsyncClass } = require('./async-class')

function _x () {
  throw new Error('bad proxy call')
}

class Moduleit extends AsyncClass {
  async init () {
    await super.init()
    this._instances = new Map()
    this._proxy = new Proxy(Object.create(null), {
      has: (_, prop) => {
        return this._instances.has(prop)
      },
      get: (_, prop) => {
        return this._instances.get(prop)
      },
      ownKeys: (_) => {
        return Array.from(this._instances.keys())
      },
      defineProperty: _x,
      deleteProperty: _x,
      set: _x
    })

    this.$pushDestructor(async () => {
      this._proxy = null
      const wait = []
      for (let inst of this._instances.values()) {
        wait.push(inst.destroy())
      }
      await Promise.all(wait)
      this._instances.clear()
      this._instances = null
    })
  }

  getProxy () {
    return this._proxy
  }

  loadModuleGroup (group) {
    const defaultConfig = {}

    const load = {}

    for (let mod of group) {
      mod.moduleitRegister(opt => {
        if (!(opt.type in defaultConfig)) {
          defaultConfig[opt.type] = {}
        }
        const defConfRef = defaultConfig[opt.type]

        if (opt.name in defConfRef) {
          throw new Error(opt.type + ':' + opt.name + ' already registered')
        }

        defConfRef[opt.name] = {
          enabled: Object.keys(defConfRef).length === 0,
          config: opt.defaultConfig
        }

        if (!(opt.type in load)) {
          load[opt.type] = {}
        }
        const loadRef = load[opt.type]
        loadRef[opt.name] = opt.construct
      })
    }

    return {
      defaultConfig,
      createGroup: async (config) => {
        const wait = []
        const startAll = []
        for (let type in config) {
          const allForType = config[type]
          for (let name in allForType) {
            const oneConf = allForType[name]
            if (!oneConf.enabled) {
              continue
            }

            if (this._instances.has(type)) {
              throw new Error('already created instance for type ' + type)
            }

            const construct = load[type][name]
            wait.push((async () => {
              const inst = await construct(
                this._proxy, oneConf.config)
              this._instances.set(type, inst)
              startAll.push(() => { return inst.start() })
            })())
          }
        }
        await Promise.all(wait)
        await Promise.all(startAll.map(fn => fn()))
      }
    }
  }
}

exports.Moduleit = Moduleit
