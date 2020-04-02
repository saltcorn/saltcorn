const bool = () => Math.random() > 0.5;

const num_between = (lo, hi) => lo + Math.random() * (hi - lo);

const num_positive = () => Math.pow(10, num_between(-3, 8));

const any_num = () => (bool() ? num_positive() : -num_positive());

module.exports = {
  bool,
  num_between,
  num_positive,
  any_num
};
