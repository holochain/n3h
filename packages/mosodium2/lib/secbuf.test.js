const expect = require('chai').expect
const mosodium = require('./index')

describe('SecBuf Suite', () => {
  for (let con of [
    'secure',
    'insecure'
  ]) {
    describe(con, () => {
      let b = null

      beforeEach(async () => {
        b = await mosodium.SecBuf[con](4)
        b.writable(w => {
          w[0] = 1
          w[1] = 2
          w[2] = 3
          w[3] = 4
        })
      })

      afterEach(async () => {
        await b.destroy()
      })

      it('can unlockMulti', async () => {
        const r = await mosodium.SecBuf.ref(Buffer.from([2, 2, 2, 2]))

        let res1 = null
        let res2 = null
        await mosodium.SecBuf.unlockMulti([
          [b, 'readable'],
          [r, 'readable']
        ], async (_b, _r) => {
          res1 = _b.toString('hex')
          res2 = _r.toString('hex')
        })

        expect(res1).equals('01020304')
        expect(res2).equals('02020202')

        await r.destroy()
      })

      it('unlockMulti errors correctly', async () => {
        const r = await mosodium.SecBuf.ref(Buffer.from([2, 2, 2, 2]))

        try {
          await mosodium.SecBuf.unlockMulti([
            [b, 'readable'],
            [r, 'readable']
          ], async (_b, _r) => {
            throw new Error('test')
          })
        } catch (e) {
          expect(e.toString()).equals('Error: test')
          return
        }

        throw new Error('expected exception, got success')
      })

      it('can get size', async () => {
        expect(b.size()).equals(4)
      })

      it('can read', async () => {
        let res = null
        await b.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('01020304')
      })

      it('can write secbuf', async () => {
        const r = await mosodium.SecBuf.insecureFrom(b, 0, 2)
        await b.write(2, r)
        let res = null
        await b.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('01020102')
        await r.destroy()
      })

      it('can clone secure', async () => {
        const r = await mosodium.SecBuf.secureFrom(b, 1, 2)
        let res = null
        await r.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('0203')
        await r.destroy()
      })

      it('can clone insecure', async () => {
        const r = await mosodium.SecBuf.insecureFrom(b, 1, 2)
        let res = null
        await r.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('0203')
        await r.destroy()
      })

      it('can increment', async () => {
        await b.increment()
        let res = null
        await b.readable(r => { res = r.toString('hex') })
        expect(res).equals('02020304')
      })

      it('should compare equal', async () => {
        const r = await mosodium.SecBuf.ref(Buffer.from([1, 2, 3, 4]))
        expect(await b.compare(r)).equals(0)
      })

      it('should compare gt', async () => {
        const r = await mosodium.SecBuf.ref(Buffer.from([0, 2, 3, 4]))
        expect(await b.compare(r)).equals(1)
      })

      it('should compare lt', async () => {
        const r = await mosodium.SecBuf.ref(Buffer.from([2, 2, 3, 4]))
        expect(await b.compare(r)).equals(-1)
      })
    })
  }
})
