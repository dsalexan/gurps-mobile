module.exports.dynamicValue = function dynamicValue(type, args = {}) {
  const obj = { type }

  if (type === `unknown`) {
    if (args) {
      obj.label = args
    }
  } else if (type === `input`) {
    obj.label = args.label
    obj.schema = args.schem
  } else if (type === `list`) {
    obj.label = args.label
    obj.options = args.options
  } else {
    debugger
  }

  return obj
}
