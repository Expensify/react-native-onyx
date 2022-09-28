// Mostly copied from  https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

/**
* Is the object Mergeable
*
* @param val
* @returns {*|boolean}
*/
function isMergeableObject(val) {
  var nonNullObject = val && typeof val === 'object';
  return nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object Date]';
}
/**
* Empty the Target
*
* @param val
* @returns {*}
*/
function emptyTarget(val) {
  return Array.isArray(val) ? [] : {}
}
/**
* Clone if Necessary
*
* @param value
* @param optionsArgument
* @returns {*}
*/
function cloneIfNecessary(value, optionsArgument) {
  var clone = optionsArgument && optionsArgument.clone === true;
  return (clone && isMergeableObject(value)) ? merge(emptyTarget(value), value, optionsArgument) : value;
}
/**
* Default Array Merge
*
* @param target
* @param source
* @param optionsArgument
* @returns {*}
*/
let valArr;
function defaultArrayMerge(target, source, optionsArgument) { 
  var destination = target.slice();
  for (let i = 0; i < source.length; ++i) {
    valArr = source[i];
    if (i >= destination.length) {
      destination.push(cloneIfNecessary(valArr, optionsArgument));
    } else if (typeof destination[i] === 'undefined') {
      destination[i] = cloneIfNecessary(valArr, optionsArgument);
    } else if (isMergeableObject(valArr)) {
      destination[i] = merge(target[i], valArr, optionsArgument);
    }
  }
  return destination;
}
/**
* Merge Object
*
* @param target
* @param source
* @param optionsArgument
* @returns {{}}
*/
function mergeObject(target, source, optionsArgument) {
  var destination = {};
  if (isMergeableObject(target)) {
    Object.keys(target).forEach(function (key) {
      destination[key] = cloneIfNecessary(target[key], optionsArgument)
    })
  }
  Object.keys(source).forEach(function (key) {
    if (!isMergeableObject(source[key]) || !target[key]) {
      destination[key] = cloneIfNecessary(source[key], optionsArgument)
    } else {
      destination[key] = merge(target[key], source[key], optionsArgument)
    }
  });
  return destination
}
/**
  * Merge Object and Arrays
  *
  * @param target
  * @param source
  * @param optionsArgument
  * @returns {*}
  */
export function merge(target, source, optionsArgument) {
  var array = Array.isArray(source);
  var options = optionsArgument || { arrayMerge: defaultArrayMerge };
  var arrayMerge = options.arrayMerge || defaultArrayMerge;
  if (array) { // We may not even need that as mergeWithCustomized suggests it
    return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : cloneIfNecessary(source, optionsArgument);
  } else {
    return mergeObject(target, source, optionsArgument);
  }
}
