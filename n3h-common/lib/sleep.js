/**
 * Helper for things like `await $sleep(100)`
 * @param {number} ms - milliseconds to wait for
 */
exports.$sleep = function $sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}
