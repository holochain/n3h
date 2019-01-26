const { type } = require('@holochain/n3h-common')
const { URL } = require('url')

type.addTerminal('url', v => typeof v === 'string' && !!new URL(v))
type.addTerminal('base64String', v => typeof v === 'string' && /^[a-zA-Z0-9+/\-_=]*$/.test(v))

function exportReq (mod) {
  for (let k in mod) {
    exports[k] = mod[k]
  }
}

exportReq(require('./connection-spec'))
exportReq(require('./dht-spec'))
exportReq(require('./p2p-spec'))
