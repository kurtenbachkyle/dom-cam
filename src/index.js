var h = require('virtual-dom/h')
var diff = require('virtual-dom/diff')
var patch = require('virtual-dom/patch')
var createElement = require('virtual-dom/create-element')
var mat3 = require('gl-mat3')
var vec2 = require('gl-vec2')
var utils = require('./utils')
var remove = utils.remove
var contains = utils.contains
var toPercent = utils.toPercent
var toDegrees = utils.toDegrees
var pp = utils.pp

var id = 0
var STAGE_EL = document.body
var CONTROLS_EL = document.getElementById('controls')

function Node (parent, children, position, size) {
  this.id = id++
  this.children = children
  this.position = position
  this.size = size
  this.rotation = 0
  this.scale = [1, 1]
  this.parent = null
  this.setParent(parent)
  Object.defineProperty(this, 'aspectRatio', {
    get() { return this.size[0] / this.size[1] }
  })
  Object.defineProperty(this, 'matrixInverse', {
    get() { 
      var m = mat3.create()
      
      mat3.translate(m, m, this.position)
      mat3.scale(m, m, this.scale)
      mat3.rotate(m, m, this.rotation)
      mat3.invert(m, m)
      return m
    }
  })
  Object.defineProperty(this, 'matrix', {
    get() {
      var m = mat3.create()
      
      mat3.translate(m, m, this.position)
      mat3.scale(m, m, this.scale)
      mat3.rotate(m, m, this.rotation)
      return m
    }
  })
}

Node.prototype.setParent = function (parent) {
  if (this.parent) remove(this.parent.children, this)
  this.parent = parent      

  if (parent) {
    if (!contains(parent.children, this)) parent.children.push(this)
    if (parent.parent == null) {
      parent.size[0] = Math.max(parent.size[0], this.size[0] + this.position[0])
      parent.size[1] = Math.max(parent.size[1], this.size[1] + this.position[1])
    }
  }
}

function Box (parent, position, size, color) {
  Node.call(this, parent, [], position, size)
  this.color = color
}

Box.prototype = Object.create(Node.prototype)

function Root () {
  Node.call(this, null, [], [0, 0], [0, 0])
}

Root.prototype = Object.create(Node.prototype)

function Camera (position, size) {
  Node.call(this, null, [], position, size)
}

Camera.prototype = Object.create(Node.prototype)

function renderDebug (parentNode, node) {
  var props  = {
    className: 'debug',
    style: {
      position: 'absolute',
      bottom: 0
    }
  }
  
  return h('div', props, [
    h('p', null, `pos:  ${node.position}`),
    h('p', null, `ppos: ${parentNode.position}`),
    h('p', null, `psz:  ${parentNode.size}`)
  ])
}

function renderNode (parentNode, node) {
  var xPercent = toPercent(node.position[0], parentNode.size[0])
  var yPercent = toPercent(node.position[1] / parentNode.aspectRatio, parentNode.size[1])
  var wPercent = toPercent(node.size[0], parentNode.size[0])
  var hPercent = toPercent(node.size[1], parentNode.size[1])
  var props = {
    className: 'node',
    style: {
      width: `${wPercent}%`,
      height: `${hPercent}%`,
      position: 'absolute',
      backgroundColor: node.color,
      transform: `translate3d(${xPercent}%, ${yPercent}%, 0) ` +
                 `rotate(${toDegrees(node.rotation)}deg) ` +
                 `scale(${node.scale[0]}, ${node.scale[1]})`
    }
  }
  var children = node.children.map(c => renderNode(node, c))
  var debug = renderDebug(parentNode, node)

  return h('div', props, [debug, ...children])
}

function renderRoot (camera, node) {
  //TODO: pretty sure this is wrong?  position should be done via matrix mult?
  var xPercent = toPercent(node.position[0] - camera.position[0], camera.size[0])
  var yPercent = toPercent(node.position[1] - camera.position[1], camera.size[1])
  var wPercent = toPercent(node.size[0], camera.size[0])
  var hPercent = toPercent(node.size[1], camera.size[1])
  var props = {
    id: 'root',
    className: 'node',
    style: {
      position: 'absolute',
      overflow: 'hidden',
      backgroundColor: node.color || 'white',
      width: `${wPercent}%`,
      height: `${hPercent}%`,
      transformOrigin: `${xPercent}% ${yPercent}`,
      transform: `translate3d(${xPercent}%, ${yPercent}%, 0) ` +
                 `rotate(${toDegrees(-camera.rotation)}deg)`
    }
  }
  var children = node.children.map(c => renderNode(node, c))

  return h('div', props, children)
}

function renderScene (el, camera, scene) {
  var wMax = el.clientWidth
  var hMax = el.clientHeight
  var wStage = wMax / hMax <= camera.aspectRatio ? wMax : camera.aspectRatio * hMax
  var hStage = wStage / camera.aspectRatio
  var props = {
    id: 'stage',
    style: {
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'white',
      width: `${toPercent(wStage, wMax)}%`,
      height: `${toPercent(hStage, hMax)}%`
    }
  }
  var root = renderRoot(camera, scene)

  return h('div', props, root)
}

var camera = new Camera([0, 0], [240, 135])
var scene = new Root
var b1 = new Box(scene, [10, 10], [100, 100], 'green')
var b2 = new Box(scene, [300, 50], [50, 50], 'blue')
var b3 = new Box(scene, [200, 100], [75, 75], 'red')
var b4 = new Box(b3, [25, 0], [25, 25], 'pink')
var gui = new dat.GUI({autoPlace: false})
var controls = {
  wander: function () {
    camera.position[0] = Math.random() * 50
    camera.position[1] = Math.random() * 50
    camera.rotation = Math.random() * Math.PI * 2
  }
}

b3.rotation = Math.PI / 8
b4.rotation = Math.PI / 8

gui.add(camera.position, '0', -50, 50)
gui.add(camera.position, '1', -50, 50)
gui.add(camera, 'rotation', 0, Math.PI * 2)
gui.add(controls, 'wander')

function makeRender () {
  var oldTree = renderScene(STAGE_EL, camera, scene)
  var root = createElement(oldTree)

  STAGE_EL.appendChild(root)
  CONTROLS_EL.appendChild(gui.domElement)
  return function render () {
    var newTree = renderScene(STAGE_EL, camera, scene)
    var patches = diff(oldTree, newTree)
    root = patch(root, patches)  
    oldTree = newTree
    requestAnimationFrame(render)
  }
}

requestAnimationFrame(makeRender())
