const mkTable = (hdrs, vs) => {
  var s = "<table><thead><tr>";
  hdrs.forEach(hdr => {
    s += `<th>${hdr.label}</th>`;
  });
  s += "</tr></thead><tbody>";
  vs.forEach(v => {
    const tds = hdrs
      .map(
        hdr =>
          `<td>${typeof hdr.key === "string" ? v[hdr.key] : hdr.key(v)}</td>`
      )
      .join("");
    s += "<tr>" + tds + "</tr>";
  });
  s += "</tbody></table>";
  return s;
};

module.exports = {
  mkTable
};
