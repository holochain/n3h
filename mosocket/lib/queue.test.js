const expect = require('chai').expect
const { Queue } = require('./queue')

describe('priority queue Suite', () => {
  let q = null

  beforeEach(() => {
    q = new Queue()
    q.enqueue(2, 'd', 'd')
    q.enqueue(4, 'f', 'f')
    q.enqueue(3, 'e', 'e')
    q.enqueue(1, 'b', 'b')
    q.enqueue(1, 'c', 'c')
    q.enqueue(-1, 'a', 'a')
  })

  it('should be a function', () => {
    expect(typeof Queue).equals('function')
  })

  it('should return in order', () => {
    expect(q.dequeue()).equals('a')
    expect(q.dequeue()).equals('b')
    expect(q.dequeue()).equals('c')
    expect(q.dequeue()).equals('d')
    expect(q.dequeue()).equals('e')
    expect(q.dequeue()).equals('f')
  })

  it('should throw if queueing empty queue', () => {
    q.clear()
    expect(() => q.dequeue()).throws()
  })

  it('should use count properly', () => {
    expect(q.count()).equals(6)
    q.clear()
    expect(q.count()).equals(0)
  })

  it('should use has properly', () => {
    expect(q.has('a')).equals(true)
    q.clear()
    expect(q.has('a')).equals(false)
  })

  it('should use isEmpty properly', () => {
    expect(q.isEmpty()).equals(false)
    q.clear()
    expect(q.isEmpty()).equals(true)
  })

  it('bad removeId should return null', () => {
    expect(q.removeId('z')).equals(null)
    expect(q.count()).equals(6)
  })

  it('good removeId should return item', () => {
    expect(q.removeId('a')).equals('a')
    expect(q.count()).equals(5)
  })

  it('good removeId should return item #2', () => {
    expect(q.removeId('c')).equals('c')
    expect(q.count()).equals(5)
  })

  it('should throw on same id', () => {
    expect(() => q.enqueue(1, 'a', 'a')).throws()
  })
})
