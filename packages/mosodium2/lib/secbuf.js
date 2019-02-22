const sodium = require('sodium-native')
const { AsyncClass } = require('@holochain/n3h-common')

class SBRoot extends AsyncClass {
  /**
   */
  async init (size) {
    await super.init()

    this._size = size
  }

  /**
   */
  size () {
    return this._size
  }
}

class SBSecure extends SBRoot {
  /**
   */
  async init (size) {
    await super.init(size)

    this._alignSize = Math.ceil(size / 8) * 8
    this._b = sodium.sodium_malloc(this._alignSize)
    sodium.sodium_mprotect_noaccess(this._b)

    this.$pushDestructor(() => {
      // normally sodium free would clear the buffer...
      // but since we're waiting for js gc, let's clear it now
      sodium.sodium_mprotect_readwrite(this._b)
      this._b.fill(0)
      sodium.sodium_mprotect_noaccess(this._b)
      this._b = null
    })
  }

  /**
   */
  async readable (fn) {
    try {
      sodium.sodium_mprotect_readonly(this._b)
      return await fn(this._b.slice(0, this._size))
    } finally {
      sodium.sodium_mprotect_noaccess(this._b)
    }
  }

  /**
   */
  async writable (fn) {
    try {
      sodium.sodium_mprotect_readwrite(this._b)
      return await fn(this._b.slice(0, this._size))
    } finally {
      sodium.sodium_mprotect_noaccess(this._b)
    }
  }
}

class SBInsecure extends SBRoot {
  /**
   */
  async init (size) {
    await super.init(size)

    this._b = Buffer.alloc(size)

    this.$pushDestructor(() => {
      this._b.fill(0)
      this._b = null
    })
  }

  /**
   */
  async readable (fn) {
    return fn(this._b)
  }

  /**
   */
  async writable (fn) {
    return fn(this._b)
  }
}

class SBRef extends SBRoot {
  /**
   */
  async init (ref) {
    if (!(ref instanceof Buffer)) {
      throw new Error('ref must be a Buffer')
    }
    await super.init(ref.byteLength)
    this._b = ref
  }

  /**
   */
  async readable (fn) {
    return fn(this._b)
  }

  /**
   */
  async writable (fn) {
    return fn(this._b)
  }
}

async function _from (oth, offset, len, Class) {
  if (typeof offset !== 'number') {
    offset = 0
  }
  if (typeof len !== 'number') {
    len = oth.size()
  }
  oth = await SecBuf.ref(oth)
  const out = await new SecBuf(await new Class(len))
  await oth.readable(async r => {
    await out.write(0, r.slice(offset, offset + len))
  })
  return out
}

/**
 */
class SecBuf extends AsyncClass {
  /**
   */
  static async unlockMulti (spec, fn) {
    const a = new Array(spec.length)

    let res = null
    let rej = null
    const promise = new Promise((resolve, reject) => {
      res = resolve
      rej = reject
    })

    const wait = []
    for (let i = 0; i < spec.length; ++i) {
      const buf = spec[i][0]
      const api = spec[i][1]
      wait.push(buf[api](async buffer => {
        try {
          a[i] = buffer
          for (let j of a) {
            if (!j) {
              await promise
              return
            }
          }
          await fn(...a)
          res()
        } catch (e) {
          rej(e)
          throw e
        }
      }))
    }
    await Promise.all(wait)
  }

  /**
   */
  static async secure (size) {
    return new SecBuf(await new SBSecure(size))
  }

  /**
   */
  static async insecure (size) {
    return new SecBuf(await new SBInsecure(size))
  }

  /**
   */
  static async ref (oth) {
    if (oth instanceof SecBuf) {
      return oth
    } else if (oth instanceof Buffer) {
      return new SecBuf(await new SBRef(oth))
    } else if (oth instanceof Uint8Array) {
      return new SecBuf(await new SBRef(Buffer.from(oth)))
    } else {
      throw new Error('oth must be a SecBuf, Buffer, or Uint8Array')
    }
  }

  /**
   */
  static async secureFrom (oth, offset, len) {
    return _from(oth, offset, len, SBSecure)
  }

  /**
   */
  static async insecureFrom (oth, offset, len) {
    return _from(oth, offset, len, SBInsecure)
  }

  /**
   */
  async init (backend) {
    await super.init()
    if (!(backend instanceof SBRoot)) {
      throw new Error('can only create SecBuf with SBSecure or SBInsecure')
    }
    this._b = backend

    this.$pushDestructor(async () => {
      await this._b.destroy()
      this._b = null
    })
  }

  /**
   */
  size () {
    return this._b.size()
  }

  /**
   */
  async readable (fn) {
    return this._b.readable(fn)
  }

  /**
   */
  async writable (fn) {
    return this._b.writable(fn)
  }

  /**
   */
  async write (offset, oth) {
    if (typeof offset !== 'number') {
      throw new Error('offset must be a number')
    }
    oth = await SecBuf.ref(oth)
    if (offset + oth.size() > this.size()) {
      throw new Error('would write out of bounds')
    }
    await this.writable(async w => {
      await oth.readable(r => {
        r.copy(w, offset)
      })
    })
  }

  /**
   */
  async increment () {
    await this.writable(async w => {
      sodium.sodium_increment(w)
    })
  }

  /**
   */
  async compare (oth) {
    oth = await SecBuf.ref(oth)
    let out = null
    await this.readable(async rA => {
      await oth.readable(async rB => {
        out = sodium.sodium_compare(rA, rB)
      })
    })
    return out
  }
}

exports.SecBuf = SecBuf
