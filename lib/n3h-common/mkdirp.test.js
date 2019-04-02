const { mkdirp } = require('./index')
const sinon = require('sinon')

mkdirp.fs = {
  handle$mkdir: [],
  mkdir: sinon.stub(),
  handle$stat: [],
  stat: sinon.stub()
}

function h$clear () {
  mkdirp.fs.handle$mkdir = []
  mkdirp.fs.handle$stat = []
}

function h$mkdir (fn) {
  mkdirp.fs.handle$mkdir.push(fn)
}

function h$mkdir$enoent () {
  h$mkdir((_, cb) => {
    const e = new Error('enoent')
    e.code = 'ENOENT'
    cb(e)
  })
}

function h$mkdir$oth () {
  h$mkdir((_, cb) => {
    const e = new Error('other')
    cb(e)
  })
}

function h$mkdir$ok () {
  h$mkdir((_, cb) => {
    cb(null)
  })
}

function h$stat (fn) {
  mkdirp.fs.handle$stat.push(fn)
}

function h$stat$isdir () {
  h$stat((_, cb) => {
    cb(null, { isDirectory: () => true })
  })
}

function h$stat$notdir () {
  h$stat((_, cb) => {
    cb(null, { isDirectory: () => false })
  })
}

describe('mkdirp Suite', () => {
  beforeEach(() => {
    sinon.reset()
    mkdirp.fs.mkdir.callsFake((p, cb) => {
      mkdirp.fs.handle$mkdir.shift()(p, cb)
    })
    mkdirp.fs.stat.callsFake((p, cb) => {
      mkdirp.fs.handle$stat.shift()(p, cb)
    })
  })

  afterEach(() => {
    sinon.reset()
    h$clear()
  })

  it('should not error on existing', async () => {
    h$mkdir$oth()
    h$stat$isdir()
    await mkdirp('test')
  })

  it('should make one prev dir', async () => {
    h$mkdir$enoent()
    h$mkdir$ok()
    h$mkdir$ok()
    await mkdirp('test')
  })

  it('should propagate system errors', async () => {
    h$mkdir$oth()
    h$stat$notdir()
    try {
      await mkdirp('test')
    } catch (e) {
      return
    }
    throw new Error('expected exception, got success')
  })
})
