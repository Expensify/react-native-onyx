// Mostly copied from  https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

function isMergeableObject(val) {
  var nonNullObject = val && typeof val === 'object';
  return nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object Date]';
}

let key = "";
function mergeObject(target, source) {
  var destination = {};
  if (isMergeableObject(target)) {
    const targetKeys = Object.keys(target);
    for (let i = 0; i < targetKeys.length; ++i) {
      key = targetKeys[i];
      destination[key] = target[key];
    }
  }
  const sourceKeys = Object.keys(source);
  for (let i = 0; i < sourceKeys.length; ++i) {
    const key = sourceKeys[i];
    if (!isMergeableObject(source[key]) || !target[key]) {
      destination[key] = source[key];
    } else {
      destination[key] = merge(target[key], source[key])
    }
  }

  return destination;
}

export function merge(target, source) {
  var array = Array.isArray(source);
  if (array) {
    return source;
  } else {
    return mergeObject(target, source);
  }
}
