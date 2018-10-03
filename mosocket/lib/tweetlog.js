const _ = { t: 1, d: 2, i: 3, w: 4, e: 5 }
const $ = []
let c = { _: 'i' }
const e = (...a) => {
  for (let l of $) {
    try { l(...a) } catch (e) {}
  }
}
const f = module.exports = (t) => {
  const o = {}
  ;['t', 'd', 'i', 'w', 'e'].forEach((l) => {
    o[l] = (...a) => {
      if (!f.should(l, t)) return
      e(l, t, ...a)
    }
  })
  return o
}
f.gte = (a, b) => {
  return _[a] >= _[b]
}
f.should = (l, t) => {
  return f.gte(l, c.t || c._)
}
f.set = (l, t) => {
  c[t || '_'] = l
}
f.listen = $.push.bind($)
f.clear = () => {
  $.splice(0)
  c = { _: 'i' }
}
const $l = console.log.bind(console)
const $e = console.error ? console.error.bind(console) : $l
f.console = (l, t, ...a) => {
  (f.gte(l, 'w') ? $e : $l)(`(${t}) [${l}] ${a.map((a) => a.stack || a.toString()).join(' ')}`)
}
