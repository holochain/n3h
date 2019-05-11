const { type } = require('../n3h-common')
const { URL } = require('url')

type.addTerminal('url', v => typeof v === 'string' && !!new URL(v))
type.addTerminal('base64String', v => typeof v === 'string' && /^[a-zA-Z0-9+/\-_=]*$/.test(v))

function exportReq (mod) {
  for (let k in mod) {
    exports[k] = mod[k]
  }
}

exportReq(require('./connection-iface'))
exportReq(require('./dht-iface'))
exportReq(require('./p2p-iface'))
exportReq(require('./discovery-iface'))
