const crypto = require('crypto')
const os = require('os')
const fs = require('fs')
const path = require('path')
const msgpack = require('msgpack-lite')

const { N3hRealMode } = require('../../lib/index')
const { ConnectionBackendWss } = require('../../lib/n3h-mod-connection-wss')

class Carrot {
  constructor (emit) {
    this._emit = emit

    process.stdin.setEncoding('utf8')
    process.stdin.resume()
    process.stdin.setRawMode(true)

    this._line = ''
    this._getc = (c) => {
      switch (c) {
        case '\r':
        case '\n':
          const tmp = this._line
          this._line = ''
          this._emit({ type: 'input', value: tmp })
          break
        case '\u0004':
        case '\u0003':
          this.destroy()
          this._emit({ type: 'destroy' })
          break
        default:
          if (c.charCodeAt(0) === 127) {
            this._line = this._line.substr(0, this._line.length - 1)
            this._display()
          } else {
            this._line += c
            this._display()
          }
          break
      }
    }

    process.stdin.on('data', this._getc)

    this.setPrompt('> ')
  }

  destroy () {
    process.stdin.removeListener('data', this._getc)
    process.stdin.setRawMode(false)
    process.stdin.pause()
    console.log()
  }

  setPrompt (p) {
    if (this._prompt !== p) {
      this._prompt = p
      this._display()
    }
  }

  display (...args) {
    process.stdout.write('\u001B[2K\r')
    console.log(...args)
    this._display()
  }

  // -- private -- //

  _display () {
    process.stdout.write('\u001B[2K\r')
    process.stdout.write(this._prompt)
    process.stdout.write(this._line)
  }
}

class BusyChat {
  constructor () {
    this._name = this._agentId = Math.random().toString(36).substr(2)
    this._activeChannel = null
    this._channels = new Set()
  }

  async run () {
    return new Promise(async (resolve, reject) => {
      try {
        this._stats = {
          entryCount: 0
        }

        const workDir = path.resolve(os.homedir(), '.busychat')

        try {
          fs.mkdirSync(workDir)
        } catch (e) { /* pass */ }

        process.env.N3H_WORK_DIR = workDir

        this._io = new Carrot(e => {
          this._handleIoEvent(e)
        })

        this._display('loading n3h...')
        this._n3h = await new N3hRealMode(workDir, {
          network: {
            useTransientTransportId: true
          }
        })
        await this._n3h.run()
        this._display('n3h loaded!\n')
        this._display(this._n3h.getAdvertise())
        this._display(this._n3h.getIpcBinding())

        this._display('connecting to ipc...')
        this._ipc = (await new ConnectionBackendWss({
          rsaBits: 1024,
          passphrase: 'hello'
        })).connectionInterface
        this._ipc.on('event', e => this._handleIpcEvent(e))
        await this._ipc.connect(this._n3h.getIpcBinding())
        this._ipcSend({
          method: 'trackDna',
          dnaAddress: '$bot$',
          agentId: this._agentId
        })
        this._joinChannel('general')
        this._display('ipc connected!\n')

        let ranTerm = false
        const handleTerm = async () => {
          if (ranTerm) {
            return
          }
          ranTerm = true
          console.log(
            'shutting down busychat, from', (new Error('stack')).stack)
          clearTimeout(this._timerId)
          this._io.destroy()
          await this._ipc.destroy()
          await this._n3h.destroy()
          console.log('busychat cleanup success')
          resolve()
        }

        this._masterResolve = (...args) => {
          handleTerm().then(() => {
            resolve(...args)
          })
        }

        this._masterReject = (err) => {
          console.error(err)
          console.error(
            'master reject invoked from', (new Error('stack')).stack)
          handleTerm().then(() => {
            reject(err)
          })
        }

        process.on('SIGINT', () => {
          handleTerm()
          process.exit(1)
        })
        process.on('SIGTERM', () => {
          handleTerm()
          process.exit(1)
        })
        process.on('exit', handleTerm)
        process.on('uncaughtException', e => {
          console.error(e.stack || e.toString())
          handleTerm().then(() => {
            process.exit(1)
          })
        })

        this._displayHelp()

        this._updatePrompt()

        this._timerId = setInterval(() => {
          this._busyTick()
        }, 1000)
      } catch (e) {
        this._masterReject ? this._masterReject(e) : reject(e)
      }
    })
  }

  // -- private -- //

  _busyTick () {
    this._publishMessage('$bot$', crypto.randomBytes(32).toString('base64'))
  }

  _fpad (i, w) {
    return ('' + parseInt(i, 10)).padStart(w, ' ')
  }

  _updatePrompt () {
    this._io.setPrompt(
      this._stats.entryCount + ' ent ' +
      '[' + this._activeChannel + '] ' +
      this._name +
      '> '
    )
  }

  _handleIoEvent (e) {
    switch (e.type) {
      case 'destroy':
        this._masterResolve()
        break
      case 'input':
        this._handleInput(e.value)
        break
    }
  }

  _display (...args) {
    this._io.display(...args)
    this._updatePrompt()
  }

  _joinChannel (channel) {
    this._activeChannel = channel
    if (this._channels.has(channel)) {
      return
    }
    this._ipcSend({
      method: 'trackDna',
      dnaAddress: channel,
      agentId: this._agentId
    })
    this._channels.add(channel)
    this._display('joined channel [' + this._activeChannel + ']')
  }

  _partChannel (channel) {
    if (!this._channels.has(channel)) {
      this._display('you are not in channel [' + channel + ']')
      return
    }
    if (this._channels.size <= 1) {
      this._display('you must be a part of at least 1 channel')
      return
    }
    if (channel !== '$bot$') {
      this._ipcSend({
        method: 'untrackDna',
        dnaAddress: channel,
        agentId: this._agentId
      })
    }
    this._channels.delete(channel)
    this._activeChannel = this._channels.values().next().value
    this._display('left channel [' + channel + ']')
  }

  _fetchMessage (channel, entryAddress) {
    this._ipcSend({
      method: 'fetchEntry',
      dnaAddress: channel,
      requesterAgentId: this._agentId,
      entryAddress
    })
  }

  _fetchMeta (channel, entryAddress, attribute) {
    this._ipcSend({
      method: 'fetchMeta',
      dnaAddress: channel,
      requesterAgentId: this._agentId,
      entryAddress,
      attribute
    })
  }

  _publishMessage (channel, message) {
    const entryAddress = crypto.randomBytes(32).toString('base64')
    this._ipcSend({
      method: 'publishEntry',
      dnaAddress: channel,
      providerAgentId: this._agentId,
      entryAddress,
      content: {
        type: 'message',
        from: this._name,
        data: message
      }
    })
    this._ipcSend({
      method: 'publishMeta',
      dnaAddress: channel,
      providerAgentId: this._agentId,
      entryAddress: entryAddress,
      attribute: 'testAttr',
      contentList: [
        {
          test: 'meta1'
        },
        {
          test: 'meta2'
        }
      ]
    })
  }

  _handleInput (value) {
    const trimmed = value.trim().toLowerCase()
    if (trimmed.startsWith('/help')) {
      this._displayHelp()
    } else if (trimmed.startsWith('/quit')) {
      this._masterResolve()
    } else if (trimmed.startsWith('/name')) {
      this._name = trimmed.substr(5).trim()
      this._display('set name to [' + this._name + ']')
    } else if (trimmed.startsWith('/join')) {
      const channel = trimmed.substr(5).trim()
      this._joinChannel(channel)
    } else if (trimmed.startsWith('/part')) {
      const channel = trimmed.substr(5).trim()
      this._partChannel(channel)
    } else if (trimmed.startsWith('/status')) {
      let out = ['channels:']
      for (let c of this._channels) {
        out.push(' - [' + c + ']')
      }
      this._display(out.join('\n'))
    } else if (trimmed.startsWith('/list')) {
      this._display('sorry... I don\'t know how to list channels yet')
    } else {
      // publish a message to the active channel
      this._publishMessage(this._activeChannel, value)
    }
  }

  _displayHelp () {
    this._display(`
busychat n3h test app
/help                - display this help
/name [new_name]     - give yourself a new name
/join [channel_name] - listen to [channel_name] - create if it doesn't exist
                       messages will send to the most recently joined channel
                       joining an already joined channel will mark it active
/part [channel_name] - leave, stop listening to [channel_name]
/list                - list all known channels
/status              - show info such as which channels you have joined
/quit                - exit busychat
`)
  }

  _ipcSend (data) {
    let msg = Buffer.from(JSON.stringify(data), 'utf8')
    msg = msgpack.encode({ name: 'json', data: msg }).toString('base64')
    this._ipc.send(Array.from(this._ipc.keys()), msg)
  }

  _handleIpcEvent (e) {
    if (e.type === 'message') {
      const outer = msgpack.decode(Buffer.from(e.buffer, 'base64'))
      const name = outer.name.toString()
      if (name === 'json') {
        const data = JSON.parse(outer.data.toString('utf8'))
        if (typeof data.method === 'string') {
          this._handleParsedIpcEvent(data)
        }
      }
    }
  }

  _handleParsedIpcEvent (e) {
    switch (e.method) {
      case 'peerConnected':
        this._display(JSON.stringify(e))
        break
      case 'handleGetPublishingEntryList':
      case 'handleGetHoldingEntryList':
      case 'handleGetPublishingMetaList':
      case 'handleGetHoldingMetaList':
        // ignore some explicitly un-handled messages
        break
      case 'handleStoreEntry':
        this._stats.entryCount += 1
        this._updatePrompt()

        this._fetchMessage(e.dnaAddress, e.entryAddress)
        break
      case 'handleStoreMeta':
        this._fetchMeta(e.dnaAddress, e.entryAddress, e.attribute)
        break
      case 'fetchEntryResult':
        if (!this._channels.has(e.dnaAddress)) {
          return
        }

        this._display(
          '[' + e.dnaAddress + ']', e.content.from + ':', e.content.data)
        break
      case 'fetchMetaResult':
        // console.log(e)
        break
      default:
        console.error('unhandled ' + JSON.stringify(e))
        return process.exit(13298)
    }
  }
}

module.exports = exports = async function _main () {
  const chat = new BusyChat()
  await chat.run()
}
