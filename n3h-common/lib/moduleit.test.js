const { expect } = require('chai')
const { Moduleit, AsyncClass } = require('./index')

class Stub extends AsyncClass {
  async init (modules, config) {
    await super.init()
    this._modules = modules
    this._config = config
  }

  async start () {
  }

  getWho () {
    return this._config.who
  }
}

describe('Moduleit Suite', () => {
  it('should be a function', async () => {
    expect(typeof Moduleit).equals('function')
  })

  it('should not allow set on proxy', async () => {
    const m = await new Moduleit()
    try {
      m.getProxy().bob = 'hello'
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('should not allow same names', async () => {
    const m = await new Moduleit()
    try {
      m.loadModuleGroup([
        {
          moduleitRegister: (r) => {
            r({
              type: 't',
              name: 't',
              defaultConfig: {},
              Class: Stub
            })
            r({
              type: 't',
              name: 't',
              defaultConfig: {},
              Class: Stub
            })
          }
        }
      ])
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })

  it('everything', async () => {
    const m = await new Moduleit()
    const { defaultConfig, createGroup } = m.loadModuleGroup([
      {
        moduleitRegister: (r) => {
          r({
            type: 't',
            name: 't1',
            defaultConfig: { who: 'we are t1' },
            Class: Stub
          })
          r({
            type: 't',
            name: 't2',
            defaultConfig: { who: 'we are t2' },
            Class: Stub
          })
        }
      }
    ])

    await createGroup(defaultConfig)

    const p = m.getProxy()

    expect(Object.getOwnPropertyNames(p)).deep.equals(['t'])
    expect('t' in p).equals(true)
    expect('f' in p).equals(false)
    expect(p.t.getWho()).equals('we are t1')
    expect(p.t._modules.t.getWho()).equals('we are t1')

    await m.destroy()
  })
})
