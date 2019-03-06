const nest = require('depnest')
const dataurl = require('dataurl-')
const hyperfile = require('hyperfile')
const hypercrop = require('hypercrop')
const {
  h, Value, Dict, Struct,
  map, computed, when, dictToCollection
} = require('mutant')
const pull = require('pull-stream')

exports.gives = nest('about.html.editPrivate')

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
    'about.html.editPrivate': editPrivate
  })

  // TODO refactor this to use obs better
  function editPrivate (id) {
    // TODO - get this to wait till the connection is present !

    var isMe = api.keys.sync.id() === id

    var avatar = Struct({
      current: api.about.obs.imageUrl(id),
      new: Dict()
    })

    const links = api.sbot.pull.links
    var name = Struct({
      current: getRandomStrings(7) + ' ' + getRandomStrings(10), // api.about.obs.name(id),
      new: Value()
    })

    const images = computed(api.about.obs.groupedValues(id, 'image'), Object.keys)

    var namesRecord = Dict()
    // TODO constrain query to one name per peer?
    pull(
      links({dest: id, rel: 'about', values: true}),
      pull.map(e => e.value.content.name),
      pull.filter(Boolean),
      pull.drain(name => {
        var n = namesRecord.get(name) || 0
        namesRecord.put(name, n + 1)
      })
    )
    var names = dictToCollection(namesRecord)

    var publicWebHosting = Struct({
      current: api.about.obs.latestValue(id, 'publicWebHosting'),
      new: Value(api.about.obs.latestValue(id, 'publicWebHosting')())
    })

    var isPossibleUpdate = computed([name.new, avatar.new, publicWebHosting.new], (name, avatar, publicWebHostingValue) => {
      return name || avatar.link || (isMe && publicWebHostingValue !== publicWebHosting.current())
    })

    var avatarSrc = computed([avatar], avatar => {
      if (avatar.new.link) return api.blob.sync.url(avatar.new.link)
      return avatar.current
    })

    var displayedName = computed([name], name => {
      if (name.new) return name.new
      else return name.current
    })

    const modalContent = Value()
    const isOpen = Value(false)
    const modal = api.app.html.modal(modalContent, { isOpen })

    return h('AboutEditor', [
      modal,
      h('section.avatar', [
        h('section', [
          h('img', { src: '../../assets/generic_person.png', style: { 'width': '200px', height: '200px' } })
        ]),
        h('footer', displayedName)
      ]),
      h('section.description', computed(api.about.obs.description(id), (descr) => {
        if (descr == null) return '' // TODO: should be in patchcore, I think...
        return api.message.html.markdown(descr)
      }))
    ])

    function dataUrlCallback (data) {
      const cropEl = Crop(data, (err, cropData) => {
        if (err) throw err
        if (!cropData) return isOpen.set(false)

        var _data = dataurl.parse(cropData)
        api.sbot.async.addBlob(pull.once(_data.data), (err, hash) => {
          if (err) throw err // TODO check if this is safely caught by error catcher

          avatar.new.set({
            link: hash,
            size: _data.data.length,
            type: _data.mimetype,
            width: 512,
            height: 512
          })
        })
        isOpen.set(false)
      })

      modalContent.set(cropEl)
      isOpen.set(true)
    }

    function Crop (data, cb) {
      var img = h('img', { src: data })

      var crop = Value()

      waitForImg()

      return h('div.cropper', [
        crop,
        h('div.background')
      ])

      function waitForImg () {
        // WEIRDNESS - if you invoke hypecrop before img is ready,
        // the canvas instantiates and draws nothing

        if (!img.height && !img.width) {
          return window.setTimeout(waitForImg, 100)
        }

        var canvas = hypercrop(img)
        crop.set(
          h('PatchProfileCrop', [
            h('header', 'click and drag to crop your image'),
            canvas,
            h('section.actions', [
              h('button', { 'ev-click': () => cb() }, 'Cancel'),
              h('button -primary', { 'ev-click': () => cb(null, canvas.selection.toDataURL()) }, 'Okay')
            ])
          ])
        )
      }
    }

    function clearNewSelections () {
      name.new.set(null)
      avatar.new.set({})
      publicWebHosting.new.set(publicWebHosting.current())
    }

    function handleUpdateClick () {
      const newName = name.new()
      const newAvatar = avatar.new()

      const msg = {
        type: 'about',
        about: id
      }

      if (newName) msg.name = newName
      if (newAvatar.link) msg.image = newAvatar
      if (publicWebHosting.new() !== publicWebHosting.current()) msg.publicWebHosting = publicWebHosting.new()

      api.message.html.confirm(msg, (err, data) => {
        if (err) return console.error(err)

        clearNewSelections()

        // TODO - update aliases displayed
      })
    }
  }
}

function getRandomStrings(length) {
  const value = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randoms = [];
  for(let i=0; i < length; i++) {
    randoms.push(value[Math.floor(Math.random()*value.length)]);
  }
  return randoms.join('');
}