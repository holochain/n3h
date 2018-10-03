/**
 * Naive priority queue implementation. Should still be pretty performant.
 */
class Queue {
  /**
   * initialize our priority buckets by calling `clear()`
   */
  constructor () {
    this.clear()
  }

  /**
   * reset everything
   */
  clear () {
    this._buckets = new Map()
    this._ids = new Map()
  }

  /**
   * remove the item if any filed under `id`
   * @param {string} id - the id to remove
   * @return {*|null} - the item, if found
   */
  removeId (id) {
    if (!this.has(id)) {
      return null
    }
    const prio = this._ids.get(id)
    const bucketRef = this._buckets.get(prio)
    for (let i = 0; i < bucketRef.length; ++i) {
      const itemRef = bucketRef[i]
      if (itemRef.id === id) {
        bucketRef.splice(i, 1)
        if (bucketRef.length === 0) {
          this._buckets.delete(prio)
        }
        this._ids.delete(id)
        return itemRef.item
      }
    }
  }

  /**
   * do we have this id currently in our queue?
   * @param {string} id - the id to check for
   * @return {boolean} - true if the id is queued
   */
  has (id) {
    return this._ids.has(id)
  }

  /**
   * how many items are we tracking?
   * @return {number} - item count in queue
   */
  count () {
    return this._ids.size
  }

  /**
   * is our queue empty?
   * @return {boolean} - true if the queue is empty
   */
  isEmpty () {
    return this._ids.size === 0
  }

  /**
   * add an item to the queue
   * @param {number} priority - integer priority
   * @param {string} id - the id to associate with `item`
   * @param {*} item - the item to store in the queue
   */
  enqueue (priority, id, item) {
    if (this._ids.has(id)) {
      throw new Error('duplicate id: ' + id)
    }
    priority = (priority | 0).toString()
    if (!this._buckets.has(priority)) {
      this._buckets.set(priority, [])
    }
    this._buckets.get(priority).push({
      id,
      item
    })
    this._ids.set(id, priority)
  }

  /**
   * get the next item off the queue
   * @return {*} the next item, throws if empty
   */
  dequeue () {
    if (this.isEmpty()) {
      throw new Error('queue is empty')
    }
    const firstPrio = Array.from(this._buckets.keys()).sort(_sort)[0]
    const bucketRef = this._buckets.get(firstPrio)
    const itemRef = bucketRef.shift()
    if (bucketRef.length === 0) {
      this._buckets.delete(firstPrio)
    }
    this._ids.delete(itemRef.id)
    return itemRef.item
  }
}

/**
 * priorities are stringified integers.
 * we need to convert them back to actual ints to sort.
 * @private
 */
function _sort (a, b) {
  if (a === b) {
    return 0
  } else if ((a | 0) < (b | 0)) {
    return -1
  }
  return 1
}

// export
exports.Queue = Queue
