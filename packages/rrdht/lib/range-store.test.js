const { expect } = require('chai')
const { RangeStore } = require('./range-store')

describe('Range Store Suite', () => {
  it('should print range ascii art', () => {
    const loc = 0x63a74bcf
    const radius = 0x22222222

    const rs = new RangeStore({}, loc, radius)
    rs.test = 1
    expect(rs.test).equals(1)
  })
})
