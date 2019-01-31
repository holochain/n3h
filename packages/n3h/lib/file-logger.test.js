const { expect } = require('chai')
const { $sleep } = require('@holochain/n3h-common')
const fs = require('fs')
const path = require('path')
const tmp = require('tmp')
tmp.setGracefulCleanup()

const { buildLogHandler } = require('./file-logger')

describe('file-logger Suite', () => {
  let d = null
  let l = null

  beforeEach(() => {
    d = tmp.dirSync({
      unsafeCleanup: true
    })
    l = buildLogHandler({
      dir: d.name,
      rotateMs: 5,
      keepCount: 2
    })
  })

  afterEach(async () => {
    // some time for file creation to proceed
    await $sleep(10)

    // for windows... looks like we need to manually remove
    for (let file of fs.readdirSync(d.name)) {
      try {
        fs.unlinkSync(path.join(d.name, file))
      } catch (e) { /* pass */ }
    }

    await $sleep(0)

    try {
      d.removeCallback()
    } catch (e) { /* pass */ }

    d = null

    l.cleanup()
    l = null
  })

  it('should log and prune', async () => {
    l('w', 'test', 'one')
    await $sleep(10)
    l('w', 'test', 'two')
    await $sleep(10)
    l('w', 'test', 'three')
    await $sleep(10)
    l('w', 'test', 'four')
    await $sleep(0)
    expect(fs.readdirSync(d.name).length).lessThan(4)
  })

  it('should log', async () => {
    l('w', 'test', 'one')
    await $sleep(10)
    const f = path.join(d.name, fs.readdirSync(d.name)[0])
    const data = fs.readFileSync(f).toString()
    expect(data).contains('~*~')
    expect(data).contains('(test) [w] one')
  })
})
