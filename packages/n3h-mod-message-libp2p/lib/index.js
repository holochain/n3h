const { Wrapper } = require('./wrapper')

exports.moduleitRegister = (register) => {
  register({
    type: 'message',
    name: 'libp2p',
    defaultConfig: {
      '#bindList': 'array of multiaddr network interfaces to listen on (can be empty)',
      bindList: [
        '/ip4/0.0.0.0/tcp/0'
      ],
      '#connectList': 'array of initial outgoing bootstrap connections to make (can be empty)',
      connectList: [
      ]
    },
    construct: (...args) => {
      return new Wrapper(...args)
    }
  })
}
