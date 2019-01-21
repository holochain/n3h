function exportReq (mod) {
  for (let k in mod) {
    exports[k] = mod[k]
  }
}

exportReq(require('./connection-spec'))
exportReq(require('./dht-spec'))
