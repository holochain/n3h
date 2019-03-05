const { AsyncClass } = require('./index')

const BAN = [
  '_',
  'destroy',
  'then',
  'Symbol(util.inspect.custom)',
  'inspect',
  'Symbol(Symbol.iterator)',
  'Symbol(Symbol.toStringTag)'
]

function _x () {
  throw new Error('bad proxy call')
}

class ModMod extends AsyncClass {
  async init (api) {
    await super.init()

    this.api = api
    this.cls = {}
  }

  register (clsList) {
    if (!Array.isArray(clsList)) {
      clsList = [clsList]
    }
    for (let Cls of clsList) {
      const def = Cls.getDefinition()
      if (BAN.indexOf(def.type) > -1) {
        throw new Error('invalid type: ' + def.type)
      }
      if (!(def.type in this.api)) {
        throw new Error('cannot register type ' + def.type + ', not in api')
      }
      const spot = def.type + '.' + def.name
      if (spot in this.cls) {
        throw new Error(spot + ' already registered')
      }
      this.cls[spot] = {
        Cls,
        def
      }
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

    const destroy = () => {
      console.error('destroy is unimplemented.')
    }

    const proxy = new Proxy(Object.create(null), {
      has: (_, prop) => {
        return instances.has(prop)
      },
      get: (_, prop) => {
        if (prop.toString() === 'destroy') {
          return destroy
        }
        // it's hard to return a proxy from an async function in nodejs...
        if (BAN.indexOf(prop.toString()) > -1) {
          return
        }
        const out = instances.get(prop)
        if (!out) {
          throw new Error(prop.toString() + ' module not found, is it loaded? ' + JSON.stringify(Array.from(instances.keys())))
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
            wait.push((async () => {
              const i = await new this.cls[type + '.' + name].Cls(
                config[type][name].config, proxy)
              const api = this.api[type]
              api.push('_')
              instances.set(type, new Proxy(Object.create(null), {
                has: (_, prop) => {
                  prop = prop.toString()
                  return api.indexOf(prop) > -1
                },
                get: (_, prop) => {
                  prop = prop.toString()
                  if (prop === '_') {
                    return i
                  }
                  if (api.indexOf(prop) < 0 || !(prop in i)) {
                    throw new Error(prop + ' not found for ' + type + '.' + name + ', not in api?')
                  }
                  if (typeof i[prop] === 'function') {
                    return i[prop].bind(i)
                  } else {
                    return i[prop]
                  }
                },
                ownKeys: (_) => {
                  return api.slice(0)
                },
                defineProperty: _x,
                deleteProperty: _x,
                set: _x
              }))
            })())
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
    for (let i of instances.values()) {
      if (!('ready' in i._)) {
        throw new Error(i._.constructor + ' is missing a "ready" function')
      }
      wait.push(i._.ready(proxy))
    }
    await Promise.all(wait)

    return proxy
  }
}

exports.ModMod = ModMod
