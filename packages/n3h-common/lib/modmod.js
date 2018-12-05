const { AsyncClass } = require('./index')

function _x () {
  throw new Error('bad proxy call')
}

class ModMod extends AsyncClass {
  async init () {
    await super.init()

    this.cls = {}
  }

  register (Cls) {
    const def = Cls.getDefinition()
    const spot = def.type + '.' + def.name
    if (spot in this.cls) {
      throw new Error(spot + ' already registered')
    }
    this.cls[spot] = {
      Cls,
      def
    }
  }

  getDefaultConfig () {
    const conf = {}
    for (let spot in this.cls) {
      const { def } = this.cls[spot]
      let enabled = false
      if (!(def.type in conf)) {
        enabled = true
        conf[def.type] = {}
      }
      const ref = conf[def.type]
      if (def.name in ref) {
        throw new Error(def.name + ' already registered for ' + def.type)
      }
      ref[def.name] = {
        enabled,
        config: JSON.parse(JSON.stringify(def.defaultConfig))
      }
    }
    return JSON.stringify(conf, null, 2)
  }

  async launch (config) {
    const instances = new Map()

    const proxy = new Proxy(Object.create(null), {
      has: (_, prop) => {
        return instances.has(prop)
      },
      get: (_, prop) => {
        // it's hard to return a proxy from an async function in nodejs...
        switch (prop.toString()) {
          case 'then':
          case 'Symbol(util.inspect.custom)':
          case 'inspect':
          case 'Symbol(Symbol.iterator)':
          case 'Symbol(Symbol.toStringTag)':
            return
          default:
            break
        }
        const out = instances.get(prop)
        if (!out) {
          throw new Error(prop.toString() + ' module not found, is it loaded?')
        }
        return out
      },
      ownKeys: (_) => {
        return Array.from(instances.keys())
      },
      defineProperty: _x,
      deleteProperty: _x,
      set: _x
    })

    let wait = []
    for (let type in config) {
      let found = false
      for (let name in config[type]) {
        if (config[type][name].enabled) {
          if (!found) {
            found = true
            wait.push(async () => {
              const i = await new this.cls[type + '.' + name].Cls(
                config[type][name].config, proxy)
              instances[type] = i
            })
          } else {
            throw new Error('two enabled configs for type ' + type)
          }
        }
      }
      if (!found) {
        throw new Error('could not find enabled config for type ' + type)
      }
    }
    await Promise.all(wait)

    wait = []
    for (let type in instances) {
      wait.push(instances[type].ready(proxy))
    }
    await Promise.all(wait)

    return proxy
  }
}

exports.ModMod = ModMod
