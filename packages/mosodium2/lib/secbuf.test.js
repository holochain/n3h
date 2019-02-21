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

      it('can get size', async () => {
        expect(b.size()).equals(4)
      })

      it('can read', async () => {
        let res = null
        b.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('01020304')
      })

      it('can write secbuf', async () => {
        const r = await mosodium.SecBuf.insecureFrom(b, 0, 2)
        b.write(2, r)
        let res = null
        b.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('01020102')
        await r.destroy()
      })

      it('can clone secure', async () => {
        const r = await mosodium.SecBuf.secureFrom(b, 1, 2)
        let res = null
        r.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('0203')
        await r.destroy()
      })

      it('can clone insecure', async () => {
        const r = await mosodium.SecBuf.insecureFrom(b, 1, 2)
        let res = null
        r.readable(r => {
          res = r.toString('hex')
        })
        expect(res).equals('0203')
        await r.destroy()
      })
    })
  }
})
