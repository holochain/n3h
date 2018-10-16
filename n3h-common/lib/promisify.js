/**
 * promisify anything that takes a trailing nodejs-style callback argument
 * @param {function} fn - trailing nodejs-style callback argument function
 */
exports.$p = function $p (fn) {
  return new Promise((resolve, reject) => {
    try {
      fn((err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    } catch (e) {
      reject(e)
    }
  })
}
