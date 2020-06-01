const removeEmptyStrings = obj => {
    var o = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== "" && v !== null) o[k] = v;
    });
    return o;
  };
  const isEmpty = o=> Object.keys(o).length===0
module.exports  = {removeEmptyStrings, isEmpty}