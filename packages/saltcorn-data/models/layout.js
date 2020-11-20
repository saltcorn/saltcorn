const traverseSync = (layout, visitors) => {
  const go = async (segment) => {
    if (!segment) return;
    if (visitors[segment.type]) {
      visitors[segment.type](segment);
    }
    if (segment.contents) {
      if (typeof contents !== "string") go(segment.contents);
      return;
    }
    if (segment.above) {
      for (const seg of segment.above) go(seg);
      return;
    }
    if (segment.besides) {
      for (const seg of segment.besides) go(seg);
      return;
    }
  };
  go(layout);
};

const traverse = async (layout, visitors) => {
  const go = async (segment) => {
    if (!segment) return;
    if (visitors[segment.type]) {
      await visitors[segment.type](segment);
      return;
    }
    if (segment.contents) {
      if (typeof contents !== "string") await go(segment.contents);
      return;
    }
    if (segment.above) {
      for (const seg of segment.above) await go(seg);
      return;
    }
    if (segment.besides) {
      for (const seg of segment.besides) await go(seg);
      return;
    }
  };
  await go(layout);
};

const eachView = (layout, f) => traverse(layout, { view: f });

const getViews = async (layout) => {
  const views = [];
  await eachView(layout, (segment) => {
    views.push(segment);
  });
  return views;
};
//getViews: is.fun([], is.promise(is.array(is.obj()))),
//eachView: is.fun(is.fun(is.obj(), is.any), is.promise(is.undefined)),
module.exports = { eachView, getViews, traverse, traverseSync };
