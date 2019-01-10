const https = require('https')

const agent = new https.Agent({
  rejectUnauthorized: false
})

exports.request = (options, postData) => {
  const o = {
    agent
  }
  for (let key in options) {
    o[key] = options[key]
  }

  return new Promise((resolve, reject) => {
    try {
      const req = https.request(o, (res) => {
        try {
          let body = Buffer.alloc(0)

          res.on('data', chunk => {
            try {
              body = Buffer.concat([body, chunk])
            } catch (e) {
              reject(e)
            }
          })

          res.on('end', () => {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body
            })
          })
        } catch (e) {
          reject(e)
        }
      })

      req.on('error', reject)

      if (postData) {
        req.write(postData)
      }

      req.end()
    } catch (e) {
      reject(e)
    }
  })
}
