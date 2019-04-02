const expect = require('chai').expect
const sodium = require('./index')

describe('SecBuf Suite', () => {
  for (let memLockType of [
    sodium.SecBuf.LOCK_NONE, sodium.SecBuf.LOCK_MEM, sodium.SecBuf.LOCK_ALL
  ]) {
    describe('MemLock `' + memLockType + '`', () => {
      let toSend = []

      beforeEach(() => {
        toSend = []

        sodium.SecBuf.setLockLevel(memLockType)
        sodium.SecBuf._stdin = {
          setRawMode: () => {},
          setEncoding: () => {},
          resume: () => {},
          pause: () => {},
          on: (_, cb) => {
            for (let c of toSend) {
              setImmediate(() => {
                cb(c)
              })
            }
          },
          removeListener: () => {}
        }
        sodium.SecBuf._stderr = {
          write: d => {}
        }
      })

      afterEach(() => {
        sodium.SecBuf._stdin = process.stdin
        sodium.SecBuf._stderr = process.stderr
      })

      it('should report correct lockLevel', () => {
        const r = new sodium.SecBuf(1)
        expect(r.lockLevel()).equals(memLockType)
        r.free()
      })

      it('should be able to generate random', () => {
        const r = new sodium.SecBuf(1)
        // should not throw any exceptions
        r.randomize()
        r.free()
      })

      it('should init from buffer', () => {
        const r = sodium.SecBuf.from(Buffer.from('hello'))
        expect(r.size()).equals(5)
        r.free()
      })

      it('should throw on bad from', () => {
        try {
          sodium.SecBuf.from(2)
        } catch (e) {
          return
        }
        throw new Error('expected exception, got success')
      })

      it('should be able to query size', () => {
        const r = new sodium.SecBuf(1)
        expect(r.size()).equals(1)
        const r2 = new sodium.SecBuf(12)
        expect(r2.size()).equals(12)
        r.free()
        r2.free()
      })

      it('readable should propagate throw', () => {
        const sb = new sodium.SecBuf(1)
        expect(() => {
          sb.readable(() => { throw new Error('e') })
        }).throws()
        sb.free()
      })

      it('writable should propagate throw', () => {
        const sb = new sodium.SecBuf(1)
        expect(() => {
          sb.writable(() => { throw new Error('e') })
        }).throws()
        sb.free()
      })

      it('should readPrompt', async () => {
        toSend = ['h', 'i', '\u0004']
        const p = await sodium.SecBuf.readPrompt('test: ')
        p.readable(_p => {
          expect(_p.toString('base64')).equals('aGk=')
        })
        p.free()
      })

      it('should readPrompt with backspace', async () => {
        toSend = ['h', 'i', 'o', String.fromCharCode(127), '\u0004']
        const p = await sodium.SecBuf.readPrompt('test: ')
        p.readable(_p => {
          expect(_p.toString('base64')).equals('aGk=')
        })
        p.free()
      })

      it('should throw on readPrompt ctrl-c', async () => {
        toSend = ['h', 'i', '\u0003']
        try {
          await sodium.SecBuf.readPrompt('test: ')
        } catch (e) {
          // yay, exception
          return
        }
        throw new Error('expected exception, but succeeded')
      })

      it('should throw if not a tty', async () => {
        delete sodium.SecBuf._stdin.setRawMode
        try {
          await sodium.SecBuf.readPrompt('test: ')
        } catch (e) {
          // yay, exception
          return
        }
        throw new Error('expected exception, but succeeded')
      })

      it('should throw if pw too big', async () => {
        for (let i = 0; i < 258; ++i) {
          toSend.push('u')
        }
        try {
          await sodium.SecBuf.readPrompt('test: ')
        } catch (e) {
          // yay, exception
          return
        }
        throw new Error('expected exception, but succeeded')
      })
    })
  }
})
