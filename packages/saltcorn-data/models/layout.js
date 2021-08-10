const { getState } = require("../db/state");

const traverseSync = (layout, visitors) => {
  const go = (segment) => {
    if (!segment) return;
    if (visitors[segment.type]) {
      visitors[segment.type](segment);
    }
    if (Array.isArray(segment)) {
      for (const seg of segment) go(seg);
      return;
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
    if (Array.isArray(segment)) {
      for (const seg of segment) await go(seg);
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
const getStringsForI18n = (layout) => {
  const strings = [];
  traverseSync(layout, {
    blank(s) {
      if (typeof s === "string") strings.push(s);
      else if (s.contents) strings.push(s.contents);
    },
    link({ text }) {
      strings.push(text);
    },
    card({ title }) {
      strings.push(title);
    },
    tabs({ titles }) {
      strings.push(...titles);
    },
  });
  return strings;
};

const translateLayout = (layout, locale) => {
  getState().i18n.setLocale(locale);
  const __ = (s) => getState().i18n.__(s) || s;

  traverseSync(layout, {
    blank(s) {
      s.contents = __(s.contents);
    },
    link(s) {
      s.text = __(s.text);
    },
    card(s) {
      s.title = __(s.title);
    },
    tabs(s) {
      s.titles = s.titles.map((t) => __(t));
    },
  });
};
//getViews: is.fun([], is.promise(is.array(is.obj()))),
//eachView: is.fun(is.fun(is.obj(), is.any), is.promise(is.undefined)),
module.exports = {
  eachView,
  getViews,
  traverse,
  traverseSync,
  getStringsForI18n,
  translateLayout,
};
