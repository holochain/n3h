const expect = require('chai').expect
const { MultiAddr } = require('./multiaddr')

describe('multi-address Suite', () => {
  it('should be a function', () => {
    expect(typeof MultiAddr).equals('function')
  })

  it('fromParts', () => {
    expect(MultiAddr.fromParts('::1', 1, 2).toString())
      .equals('/ip6/::1/tcp/1/udp/2')
  })

  it('full loop blank', () => {
    const ma = new MultiAddr('')
    expect(ma.toString()).equals('')
  })

  it('full loop blank (toJSON)', () => {
    const ma = new MultiAddr('')
    expect(ma.toJSON()).equals('')
  })

  it('full loop', () => {
    const ma = new MultiAddr('/ip4/0.0.0.0/tcp/0/udp/0')
    expect(ma.toString()).equals('/ip4/0.0.0.0/tcp/0/udp/0')
  })

  it('full loop v6', () => {
    const ma = new MultiAddr('/ip6/::/tcp/0/udp/0')
    expect(ma.toString()).equals('/ip6/::/tcp/0/udp/0')
  })

  it('should throw on bad type', () => {
    expect(() => { return new MultiAddr('/bad/0.0.0.0') }).throws()
  })

  it('rank should sort multiaddr ips by usefullness', () => {
    expect([
      '/tcp/1',
      '/udp/1',
      '/ip6/',
      '/ip4/',
      '/ip6/::1',
      '/ip6/fe::fe',
      '/ip4/127.0.0.1',
      '/ip4/1.2.3.4'
    ].map(a => new MultiAddr(a)).sort((a, b) => {
      a = a.rank()
      b = b.rank()
      if (a === b) {
        return 0
      } else if (a > b) {
        return 1
      }
      return -1
    }).map(a => a.toString())).deep.equals([
      '/ip4/1.2.3.4',
      '/ip6/fe::fe',
      '/ip4/127.0.0.1',
      '/ip6/::1',
      '/tcp/1',
      '/udp/1',
      '',
      ''
    ])
  })

  it('rank should handle need tcp / udp', () => {
    expect([
      '/ip6//tcp/1/udp/1',
      '/ip6//udp/1',
      '/ip6/::1/tcp/1',
      '/ip6/::2/udp/1',
      '/ip6/::3',
      '/ip6/::4/tcp/1/udp/1'
    ].map(a => new MultiAddr(a)).sort((a, b) => {
      a = a.rank({ needTcp: true, needUdp: true })
      b = b.rank({ needTcp: true, needUdp: true })
      if (a === b) {
        return 0
      } else if (a > b) {
        return 1
      }
      return -1
    }).map(a => a.toString())).deep.equals([
      '/ip6/::4/tcp/1/udp/1',
      '/tcp/1/udp/1',
      '/udp/1',
      '/ip6/::1/tcp/1',
      '/ip6/::2/udp/1',
      '/ip6/::3'
    ])
  })
})
