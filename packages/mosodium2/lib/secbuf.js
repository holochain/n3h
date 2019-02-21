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
  readable (fn) {
    try {
      sodium.sodium_mprotect_readonly(this._b)
      fn(this._b.slice(0, this._size))
    } finally {
      sodium.sodium_mprotect_noaccess(this._b)
    }
  }

  /**
   */
  writable (fn) {
    try {
      sodium.sodium_mprotect_readwrite(this._b)
      fn(this._b.slice(0, this._size))
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
  }

  /**
   */
  readable (fn) {
    fn(this._b)
  }

  /**
   */
  writable (fn) {
    fn(this._b)
  }
}

function _copy(sbDest, bufSrc, srcOffset, srcLen) {
  sbDest.writable(w => {
    bufSrc.copy(w, 0, srcOffset, srcLen + srcOffset)
  })
}

async function _from(oth, offset, len, Class) {
  if (typeof offset !== 'number') {
    offset = 0
  }
  if (typeof len !== 'number') {
    len = oth.size()
  }
  const out = await new SecBuf(await new Class(len))
  if (oth instanceof Buffer) {
    _copy(out, oth, offset, len)
  } else if (oth instanceof SecBuf) {
    oth.readable(r => {
      _copy(out, r, offset, len)
    })
  } else {
    throw new Error('oth must be a Buffer or a SecBuf')
  }
  return out
}

/**
 */
class SecBuf extends AsyncClass {
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
    await super.init();
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
  readable (fn) {
    return this._b.readable(fn)
  }

  /**
   */
  writable (fn) {
    return this._b.writable(fn)
  }

  /**
   */
  write (offset, oth) {
    if (typeof offset !== 'number') {
      throw new Error('offset must be a number')
    }
    if (!(oth instanceof SecBuf)) {
      throw new Error('oth must be a SecBuf')
    }
    if (offset + oth.size() > this.size()) {
      throw new Error('would write out of bounds')
    }
    this.writable(w => {
      oth.readable(r => {
        r.copy(w, offset)
      })
    })
  }
}

exports.SecBuf = SecBuf
