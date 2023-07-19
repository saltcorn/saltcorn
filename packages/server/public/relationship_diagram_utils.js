var erHelper = (() => {
  const parseHelper = (arr, parseFn, start) => {
    return arr?.length === 2 ? parseFn(arr[1]) : start;
  };

  const parseTransform = () => {
    const transform = $("svg[aria-roledescription='er']")[0].style.transform;
    if (!transform)
      return {
        translateX: 0,
        translateY: 0,
        scale: 1.0,
      };
    else
      return {
        translateX: parseHelper(
          /translateX\((.*)px\)/.exec(transform),
          Number.parseInt,
          0
        ),
        translateY: parseHelper(
          /translateY\((.*)px\)/.exec(transform),
          Number.parseInt,
          0
        ),
        scale: parseHelper(
          /scale\((.*)\)/.exec(transform),
          Number.parseFloat,
          1.0
        ),
      };
  };

  const buildTransform = ({ translateX, translateY, scale } = {}) => {
    $("svg[aria-roledescription='er']").css(
      "transform",
      `translateX(${translateX || 0}px) translateY(${
        translateY || 0
      }px) scale(${scale || 1.0})`
    );
  };

  return {
    translateY: (val) => {
      const parsed = parseTransform();
      parsed.translateY += val;
      buildTransform(parsed);
    },
    translateX: (val) => {
      const parsed = parseTransform();
      parsed.translateX += val;
      buildTransform(parsed);
    },
    zoom: (val) => {
      const parsed = parseTransform();
      parsed.scale += val;
      buildTransform(parsed);
    },
    reset: () => {
      buildTransform();
    },
    takePicture: () => {
      // TODO as png, so that you can download it via right click
      // right now, you can only print it to pdf
      const svg = $("svg[aria-roledescription='er']")[0];
      const DOMURL = self.URL || self.webkitURL || self;
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = DOMURL.createObjectURL(blob);
      window.open(url);
      DOMURL.revokeObjectURL(url);
    },
  };
})();
