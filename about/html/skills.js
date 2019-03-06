const nest = require('depnest')
const dataurl = require('dataurl-')
const hyperfile = require('hyperfile')
const hypercrop = require('hypercrop')
const {
  h, Value
} = require('mutant')
const pull = require('pull-stream')

exports.gives = nest('about.html.skills')

exports.needs = nest({
  'about.obs': {
    name: 'first',
    imageUrl: 'first',
    description: 'first',
    latestValue: 'first',
    groupedValues: 'first'
  },
  'app.html.modal': 'first',
  'blob.sync.url': 'first',
  'keys.sync.id': 'first',
  'message.html.confirm': 'first',
  'message.html.markdown': 'first',
  sbot: {
    'async.addBlob': 'first',
    'pull.links': 'first'
  }
})

exports.create = function (api) {
  return nest({
    'about.html.skills': skills
  })

  // TODO refactor this to use obs better
  function skills (id) {
    // TODO - get this to wait till the connection is present !

    var isMe = api.keys.sync.id() === id

    const modalContent = Value()
    const isOpen = Value(false)
    const modal = api.app.html.modal(modalContent, { isOpen })

    return h('SectionEditor', [
      modal,
      h('section', [
        h('header', 'Skills')
      ])
    ])
  }
}