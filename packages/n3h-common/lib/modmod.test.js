const { expect } = require('chai')

const { AsyncClass, ModMod } = require('./index')

class Test1 extends AsyncClass {
  static getDefinition () {
    return {
      type: 'test',
      name: 'Test1',
      defaultConfig: {
        '#test1': 'a comment',
        test1: 'hello'
      }
    }
  }

  async init (config, system) {
    await super.init()
    this.config = config
    this.system = system
  }

  async ready () {
    console.log('test1 ready')
  }
}

class Test2 extends AsyncClass {
  static getDefinition () {
    return {
      type: 'test',
      name: 'Test2',
      defaultConfig: {
        '#test2': 'second comment',
        test2: 'world'
      }
    }
  }

  async init (config, system) {
    await super.init()
    this.config = config
  }

  async ready () {
    console.log('test1 ready')
  }
}

describe('ModMod Suite', () => {
  let mm

  beforeEach(async () => {
    mm = await new ModMod()
    mm.register(Test1)
    mm.register(Test2)
  })

  it('should be a function', () => {
    expect(typeof ModMod).equals('function')
  })

  it('should gen defaultConfig', async () => {
    const conf = JSON.parse(mm.getDefaultConfig())
    expect(conf.test.Test1.config).deep.equals(Test1.getDefinition().defaultConfig)
    expect(conf.test.Test2.config).deep.equals(Test2.getDefinition().defaultConfig)
    expect(conf.test.Test1.enabled).equals(true)
    expect(conf.test.Test2.enabled).equals(false)
  })

  it('should launch', async () => {
    console.log(await mm.launch(JSON.parse(mm.getDefaultConfig())))
  })
})
