const util = require('./util')

const { expect } = require('chai')

const TEST_ID = 'HcSCJx45ymkaZ5trrseXzY66i5mTMic6863NveR38w5wG48Dz7Q9PC4jGDqj9ia'
const TEST_MSG = Buffer.from('THIS_IS_A_TEST', 'utf8')
const TEST_SIG = Buffer.from('4d7e3c1bddc250eca5ff40595497c5fa99d1b7fc28a3442d34b1d3575cdb934471ef33b1170b5bb7123e91ec889d8cb8872e4f2d0c26f9f4f3aee64e20844b00', 'hex')

describe('util Suite', () => {
  it('should verify signature', () => {
    expect(util.verify(TEST_SIG, TEST_MSG, TEST_ID)).equals(true)
  })
})
