const sodium = require('sodium-native')
const { AsyncClass } = require('../n3h-common')


/**
 * Abstract Base class for a buffer of a SecBuf
 * Buffer should be stored in _b
 * Expecting methods:
 *  - async readable (fn)
 *  - async writable (fn)
 *  fn: async function that takes the memory buffer as input
 */
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

/**
 * SBRoot implementation with libsodium
 */
class SBSecure extends SBRoot {
  /**
   */
  async init (size) {
    await super.init(size)

    // Create sodium buffer
    this._alignSize = Math.ceil(size / 8) * 8
    this._b = sodium.sodium_malloc(this._alignSize)
    // lock it
    sodium.sodium_mprotect_noaccess(this._b)

    // Destructor: Clear buffer memory
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
   * Make buffer readable than execute fn
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
   * Make buffer writable than execute fn
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

/**
 * SBRoot implementation with nodeJS Buffer
 */
class SBInsecure extends SBRoot {
  /**
   */
  async init (size) {
    await super.init(size)

    this._b = Buffer.alloc(size)

    // Destructor: Clear buffer memory
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

/**
 * SBRoot implementation with a ref of a nodeJS Buffer
 */
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

/**
 *
 * @param oth - A buffer to create a SecBuf out of
 * @param offset - Offset of oth buffer to create a SecBuf out of
 * @param len - Length of oth buffer to create a SecBuf out of
 * @param Class - SBSecure or SBInsecure
 * @returns A new SecBuf with the corresponding SBRoot Class out of the oth buffer
 * @private
 */
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
 * A protected SBRoot
 * Holds a SBRoot as _b
 */
class SecBuf extends AsyncClass {
  constructor (obj) {
    super(obj)
    obj && Object.assign(this, obj)
  }

  /**
   * Helper for unlocking multiple secbufs and applying a function to them
   * @param spec - array of (secBuf, 'readable|writeable')
   * @param fn - async function to process for each secBuf in spec
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
   * Create a new SecBuf with a SBSecure
   */
  static async secure (size) {
    return new SecBuf(await new SBSecure(size))
  }

  /**
   * Create a new SecBuf with a SBInsecure
   */
  static async insecure (size) {
    return new SecBuf(await new SBInsecure(size))
  }

  /**
   * Create a new SecBuf out of oth
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
   * Create a new secure SecBuf out of oth
   */
  static async secureFrom (oth, offset, len) {
    return _from(oth, offset, len, SBSecure)
  }

  /**
   * Create a new insecure SecBuf out of oth
   */
  static async insecureFrom (oth, offset, len) {
    return _from(oth, offset, len, SBInsecure)
  }


  /**
   *
   * @param backend - SBRoot backend
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
   * Write oth buffer inside this buffer starting at offset
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
   * randomize the underlying buffer
   */
  async randomize () {
    await this.writable(async w => {
      sodium.randombytes_buf(w)
    })
  }

  /**
   * sodium_increment
   */
  async increment () {
    await this.writable(async w => {
      sodium.sodium_increment(w)
    })
  }

  /**
   * return sodium_compare(this, oth)
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
