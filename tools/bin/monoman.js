#!/usr/bin/env node

const prompt = require('prompt')

const monoman = require('../lib/index')

const promptSchema = {
  properties: {
    projectName: {
      pattern: /^[a-z][a-z0-9-]*$/,
      message: 'projectName must be all lower-case or dash',
      required: true
    },
    projectDesc: {
      pattern: /^[^]+$/,
      message: 'projectDesc is required',
      required: true
    },
    template: {
      pattern: /^[a-z]+$/,
      message: 'template must be all lower-case',
      default: 'nodejs',
      required: true
    }
  }
}

function getPrompts () {
  return new Promise((resolve, reject) => {
    prompt.message = ''

    prompt.start()

    prompt.get(promptSchema, (err, res) => {
      if (err) {
        return reject(err)
      }
      resolve(res)
    })
  })
}

async function main () {
  switch (process.argv[2]) {
    case 'new':
      await monoman.buildTemplate(await getPrompts())
      break
    case 'docs':
      await monoman.docs()
      break
    default:
      console.error('UNEXPECTED COMMAND:', process.argv[2])
      console.error('monoman.js usage:')
      console.error('  `monoman.js new` - create a new repo from template')
      console.error('  `monoman.js docs` - generate docs for all projects')
      process.exit(1)
  }
}

main().then(() => {}, (err) => {
  console.error(err)
  process.exit(1)
})
