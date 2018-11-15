const sodium = require('sodium-native')

/**
 * given an arbitrary Buffer, increment as though it was a littleEndian number
 */
exports.increment = function increment (buf) {
  sodium.sodium_increment(buf)
}

/**
 * given two arbitrary Buffers treated as littleEndian numbers,
 * return:
 *  * 0 if they are equal
 *  * 1 if a > b
 *  * -1 if a < b
 */
exports.compare = function compare (a, b) {
  return sodium.sodium_compare(a, b)
}
