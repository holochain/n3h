const { expect } = require('chai')

const { $sleep } = require('./sleep')
const { Executor } = require('./exec')

describe('Executor Suite', () => {
  let e = null
  let t = null
  let s = 0

  beforeEach(async () => {
    t = []
    s = 0
    e = await new Executor()
    e.on('task', task => t.push(task))
    e.on('sched', () => ++s)
  })

  afterEach(async () => {
    await e.destroy()
    e = null
    t = null
    s = 0
  })

  it('should execute tasks', async () => {
    e.post(1)

    await $sleep(0)

    e.post(2)

    await e.drain()

    e.post(3)

    expect(t).deep.equals([ 1, 2 ])
  })

  it('should execute tasks after sleeping', async () => {
    await $sleep(21)

    e.post(1)

    await e.drain()

    expect(t).deep.equals([ 1 ])
  })

  it('should schedule', async () => {
    e.schedule('sched', 2)

    for (let i = 0; i < 15; ++i) {
      e.post()
      await $sleep(1)
    }

    expect(s).gt(2)
  })

  it('should unschedule', async () => {
    e.schedule('sched', 2)
    e.unschedule('sched')

    for (let i = 0; i < 10; ++i) {
      e.post()
      await $sleep(1)
    }

    expect(s).equals(0)
  })

  it('should throw on double schedule', () => {
    e.schedule('sched', 2)
    expect(() => {
      e.schedule('sched', 5)
    }).throws()
  })

  it('should ignore fns after destroy', async () => {
    await e.destroy()
    e.post(1)
    e.drain()
    e.schedule()
    e.unschedule()
  })
})
