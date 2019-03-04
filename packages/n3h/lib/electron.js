const { app } = require('electron')
app.disableHardwareAcceleration()

const { main } = require('./exe')

app.on('ready', () => {
  main().then(() => {}, err => {
    console.error(err)
    process.exit(1)
  })
})
