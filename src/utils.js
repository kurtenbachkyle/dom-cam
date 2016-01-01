module.exports.contains = contains
module.exports.remove = remove
module.exports.toPercent = toPercent
module.exports.toDegrees = toDegrees
module.exports.pp = pp

function contains (array, el) {
  return array.indexOf(el) !== -1
}

function remove (array, el) {
  array.splice(array.indexOf(el), 1)
}

function toPercent (top, bottom) {
  return top / bottom * 100
}

function toDegrees (rad) {
  return rad * 180 / Math.PI
}

function pp (obj) {
  console.log(JSON.stringify(obj, null, 2))
}
