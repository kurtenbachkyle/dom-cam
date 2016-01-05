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

function renderNode (parentNode, node) {
  var xPercent = toPercent(node.position[0], node.size[0])
  var yPercent = toPercent(node.position[1], node.size[1])
  var wPercent = toPercent(node.size[0], parentNode.size[0])
  var hPercent = toPercent(node.size[1], parentNode.size[1])
  var xOffsetPercent = 50 - toPercent(node.size[0] / 2, parentNode.size[0])
  var yOffsetPercent = 50 - toPercent(node.size[1] / 2, parentNode.size[1])
  var props = {
    className: 'node',
    style: {
      position: 'absolute',
      left: `${xOffsetPercent}%`,
      top: `${yOffsetPercent}%`,
      width: `${wPercent}%`,
      height: `${hPercent}%`,
      backgroundColor: node.color,
      transform: `translate3d(${xPercent}%, ${yPercent}%, 0) ` +
                 `rotate(${toDegrees(node.rotation)}deg) ` +
                 `scale(${node.scale[0]}, ${node.scale[1]})`
    }
  }
  var children = node.children.map(c => renderNode(node, c))

  return h('div', props, children)
}

function renderFromCamera (camera, node) {
  var position = vec2.transformMat3([0, 0], node.position, camera.matrixInverse)
  var xPercent = toPercent(position[0], node.size[0])
  var yPercent = toPercent(position[1], node.size[1])
  var wPercent = toPercent(node.size[0], camera.size[0])
  var hPercent = toPercent(node.size[1], camera.size[1])
  var xOffsetPercent = -toPercent(node.size[0] / 2, camera.size[0])
  var yOffsetPercent = -toPercent(node.size[1] / 2, camera.size[1])
  var props = {
    style: {
      position: 'absolute',
      left: `${xOffsetPercent}%`,
      top: `${yOffsetPercent}%`,
      width: `${wPercent}%`,
      height: `${hPercent}%`,
      backgroundColor: node.color,
      transform: `translate3d(${xPercent}%, ${yPercent}%, 0) ` +
                 `rotate(${toDegrees(node.rotation)}deg) ` +
                 `scale(${node.scale[0]}, ${node.scale[1]})`
    }
  }
  var children = node.children.map(n => renderNode(node, n))

  return h('div', props, children)
}

function renderScene (el, camera, scene) {
  var wMax = el.clientWidth
  var hMax = el.clientHeight
  var wStage = wMax / hMax <= camera.aspectRatio ? wMax : camera.aspectRatio * hMax
  var hStage = wStage / camera.aspectRatio
  var wPercent = toPercent(wStage, wMax)
  var hPercent = toPercent(hStage, hMax)
  var props = {
    id: 'stage',
    style: {
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'white',
      width: `${wPercent}%`,
      height: `${hPercent}%`
    }
  }
  var root = scene.children.map(n => renderFromCamera(camera, n))

  return h('div', props, root)
}

var camera = new Camera([-240, -135], [480, 270])
var scene = new Root
var b1 = new Box(scene, [0, 0], [75, 75], 'red')
var b2 = new Box(b1, [10, 0], [25, 25], 'blue')
var b3 = new Box(b2, [1, 0], [5, 5], 'pink')
var gui = new dat.GUI({autoPlace: false})

b1.rotation = Math.PI / 4
b2.rotation = Math.PI / 4
b3.rotation = Math.PI / 4

gui.add(camera.position, '0', -500, 500)
gui.add(camera.position, '1', -500, 500)
gui.add(camera, 'rotation', 0, Math.PI * 2)

window.camera = camera
window.scene = scene

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
