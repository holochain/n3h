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

  async ready () {
  }

  async testFn () {
    return 'test1'
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

  async ready () {
  }

  async testFn () {
    return 'test2'
  }
}

describe('ModMod Suite', () => {
  let mm

  beforeEach(async () => {
    mm = await new ModMod({
      test: ['testFn'],
      tt: ['whichTest']
    })
    mm.register(Test1)
    mm.register(Test2)

    // test out inlining
    mm.register(class {
      static getDefinition () {
        return {
          type: 'tt',
          name: 'TT',
          defaultConfig: {}
        }
      }

      constructor (config, system) {
        this.system = system
      }

      async ready () {
        this.whichTest = await this.system.test.testFn()
      }
    })
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
    const p = await mm.launch(JSON.parse(mm.getDefaultConfig()))
    expect(await p.test.testFn()).equals('test1')
  })

  it('should launch 2', async () => {
    const config = JSON.parse(mm.getDefaultConfig())
    config.test.Test1.enabled = false
    config.test.Test2.enabled = true
    const p = await mm.launch(config)
    expect(await p.test.testFn()).equals('test2')
  })

  it('should call through', async () => {
    const p = await mm.launch(JSON.parse(mm.getDefaultConfig()))
    expect(p.tt.whichTest).equals('test1')
  })

  it('should proxy', async () => {
    const p = await mm.launch(JSON.parse(mm.getDefaultConfig()))
    expect('test' in p).equals(true)
    expect(Object.getOwnPropertyNames(p).sort()).deep.equals(['test', 'tt'])
    expect('testFn' in p.test).equals(true)
    expect('_' in p.test).equals(true)
    expect(Object.getOwnPropertyNames(p.test).sort()).deep.equals(['_', 'testFn'])
  })

  it('should not proxy', async () => {
    const p = await mm.launch(JSON.parse(mm.getDefaultConfig()))
    expect(() => {
      console.log(p.z)
    }).throws()
    expect(() => {
      p.z = 'yo'
    }).throws()
    expect(() => {
      p.test.blabla()
    }).throws()
  })
})
