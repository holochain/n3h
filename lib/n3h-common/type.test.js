const { type } = require('./index')
const { expect } = require('chai')

type.addTerminal('funkyTerm', v => /^[ab]+$/.test(v))
type.addModifier('funkyMod', (v, s, e) => e(v.sub, s))

describe('type checking Suite', () => {
  ;[
    ['hi', 'string', 'number'],
    [42, 'number', 'string']
  ].forEach(v => {
    it(v[0] + ' should be a ' + v[1], () => {
      expect(type[v[1]](v[0])).equals(true)
      expect(type.is.a[v[1]](v[0])).equals(true)
      expect(type.not[v[1]](v[0])).equals(false)
      expect(type.is.not.a[v[1]](v[0])).equals(false)
      type.assert[v[1]](v[0])
      type.assert.is.a[v[1]](v[0])
      expect(() => type.assert.not[v[1]](v[0])).throws()
      expect(() => type.assert.is.not.a[v[1]](v[0])).throws()
    })

    it(v[0] + ' should not be a ' + v[2], () => {
      expect(type[v[2]](v[0])).equals(false)
      expect(type.is.a[v[2]](v[0])).equals(false)
      expect(type.not[v[2]](v[0])).equals(true)
      expect(type.is.not.a[v[2]](v[0])).equals(true)
      type.assert.not[v[2]](v[0])
      type.assert.is.not.a[v[2]](v[0])
      expect(() => type.assert[v[2]](v[0])).throws()
      expect(() => type.assert.is.a[v[2]](v[0])).throws()
    })
  })

  ;[
    [42, 'number', false],
    [[], 'string', true],
    [[42], 'string', false],
    [['hi'], 'string', true]
  ].forEach(v => {
    it('should ' + (v[2] ? '' : 'not ') + 'arrayOf.' + v[1] + '(' + JSON.stringify(v[0]) + ')', () => {
      expect(type.arrayOf[v[1]](v[0])).equals(v[2])
    })
  })

  it('should support custom terminal', () => {
    expect(type.funkyTerm('aaabba')).equals(true)
    expect(type.funkyTerm('abc')).equals(false)
  })

  it('should support custom modifier', () => {
    expect(type.funkyMod.string({ sub: 'yo' })).equals(true)
    expect(type.funkyMod.string('yo')).equals(false)
  })

  it('should throw on dup modifier', () => {
    expect(() => {
      type.addModifier('string', () => {})
    }).throws()
  })

  it('should throw on dup terminal', () => {
    expect(() => {
      type.addTerminal('string', () => {})
    }).throws()
  })
})
