'use strict'

/**
 * Execute a callback function as a promise.
 * You may need to bind any parameters to the function.
 *
 * @example
 * const data = await $p(fs.readFile.bind(fs, 'my-file.txt'))
 */
exports.$p = function $p (fn) {
  return new Promise((resolve, reject) => {
    fn((err, res) => {
      if (err) return reject(err)
      resolve(res)
    })
  })
}
