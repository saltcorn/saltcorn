const isdef = x => (typeof x === "undefined" || x === null ? false : true);

const number = opts => ({
  name: "number",
  options: opts,
  check: x =>
    typeof x === "number" &&
    (typeof (opts || {}).lte === "number" ? x <= opts.lte : true) &&
    (typeof (opts || {}).gte === "number" ? x >= opts.gte : true)
});

module.exports = {
  number
};
