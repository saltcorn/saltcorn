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
  let mouseDown = false;
  let isMoving = false;
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
      if (parsed.scale < 0.1) parsed.scale = 0.1;
      else if (parsed.scale > 20) parsed.scale = 20;
      buildTransform(parsed);
    },
    reset: () => {
      buildTransform();
    },
    takePicture: () => {
      window.open("/table/relationship-diagram/screenshot");
    },
    onWheel: (event) => {
      event.preventDefault();
      erHelper.zoom(-0.001 * event.deltaY);
    },
    onMouseDown: () => {
      mouseDown = true;
      isMoving = false;
    },
    onMouseUp: () => {
      mouseDown = false;
    },
    onMouseMove: (event) => {
      if (mouseDown) {
        isMoving = true;
        document.getSelection().removeAllRanges();
        erHelper.translateX(event.movementX);
        erHelper.translateY(event.movementY);
      }
    },
    isTranslating: () => {
      return isMoving;
    },
  };
})();
