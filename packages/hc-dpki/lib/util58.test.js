const util58 = require('./util58')
const { expect } = require('chai')

describe('util58 Suite', () => {
  ;[
    [
      'QmThBPBkjzYCS55gVKyYEjM2YaHgxd1fosEswmDF2EQJZF',
      'T4y72JjFxZz5y7ERq++1ZFt6s/RCjkAiXBlfAWlLTTo='
    ],
    [
      'QmeTJTZhHczjEFjHAum8ZTPdFEZzyywBogkdWY4CP5NTux',
      '728orrd4tN+EMrolVzIuPDoJ06G/4c60YmI2qIocpC8='
    ],
    [
      'QmYHgtUqs3tWuu25ckuMdGhqbXX1fVFz9drULSWfj5a4LR',
      'k9KXKjSerxj3wJZhnoYVb9r4Vrv+c8mRi/RJ7pWzJHo='
    ]
  ].forEach(v => {
    it('should ' + v[0], () => {
      const b64 = util58.decode(v[0])
      expect(b64).equals(v[1])
      expect(util58.encode(b64)).equals(v[0])
    })
  })
})
