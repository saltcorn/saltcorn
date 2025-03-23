/**
 * @category saltcorn-builder
 * @module components/elements/utils
 * @subcategory components / elements
 */
/* globals $, _sc_globalCsrf*/
import React, { Fragment, useState, useEffect } from "react";
import optionsCtx from "../context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faInfoCircle,
  faQuestionCircle,
  faBold,
  faItalic,
  faFont,
  faPlus,
  faCommentSlash,
  faUnderline,
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faTerminal,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useNode, Element, useEditor } from "@craftjs/core";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import Tippy from "@tippyjs/react";
import { RelationType } from "@saltcorn/common-code";
import Select from "react-select";

export const DynamicFontAwesomeIcon = ({ icon, className }) => {
  if (!icon) return null;
  return <i className={`${icon} ${className || ""}`}></i>;
};

const ntimes = (n, f) => {
  var res = [];
  for (let index = 0; index < n; index++) {
    res.push(f(index));
  }
  return res;
};

export /**
 * @param {boolean} is_block
 * @returns {object}
 */
const blockProps = (is_block) =>
  is_block ? { style: { display: "block" } } : {};

export /**
 * @param {object} props
 * @param {boolean} props.block
 * @param {function} props.setProp
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const BlockSetting = ({ block, setProp }) => (
  <div className="form-check">
    <input
      className="form-check-input"
      name="block"
      type="checkbox"
      checked={block}
      onChange={(e) => {
        if (e.target) {
          const target_value = e.target.checked;
          setProp((prop) => (prop.block = target_value));
        }
      }}
    />
    <label className="form-check-label">Block display</label>
  </div>
);

export const BlockOrInlineSetting = ({ block, inline, textStyle, setProp }) =>
  !textStyle ||
  !textStyleToArray(textStyle).some((ts) => ts && ts.startsWith("h")) ? (
    <BlockSetting block={block} setProp={setProp} />
  ) : (
    <div className="form-check">
      <input
        className="form-check-input"
        name="inline"
        type="checkbox"
        checked={inline}
        onChange={(e) => {
          if (e.target) {
            const target_value = e.target.checked;
            setProp((prop) => (prop.inline = target_value));
          }
        }}
      />
      <label className="form-check-label">Inline display</label>
    </div>
  );

export const HelpTopicLink = ({ topic, ...context }) => {
  const { mode } = React.useContext(optionsCtx);
  let qs = "";
  Object.keys(context).forEach((k) => {
    qs += `${encodeURIComponent(k)}=${encodeURIComponent(context[k])}&`;
  });
  return (
    <FontAwesomeIcon
      className="ms-1"
      icon={faQuestionCircle}
      onClick={() => window.ajax_modal(`/admin/help/${topic}?${qs}`)}
    />
  );
};

export const FormulaTooltip = () => {
  const { fields } = React.useContext(optionsCtx);
  return (
    <Tooltip>
      <div>
        Formulae in Saltcorn are JavaScript expressions based on the current
        database row.
      </div>
      {fields ? (
        <Fragment>
          {" "}
          Variables in scope: &nbsp;
          {fields.map((f, ix) => (
            <Fragment key={ix}>
              <code>{f.name}</code>{" "}
            </Fragment>
          ))}
        </Fragment>
      ) : null}

      <a
        className="d-block"
        href="https://wiki.saltcorn.com/view/ShowPage/formulas"
      >
        Wiki page on formulas
      </a>
    </Tooltip>
  );
};

export /**
 * @param {object} props
 * @param {function} props.setProp
 * @param {object} props.isFormula
 * @param {object} props.node
 * @param {string} props.nodekey
 * @param {string} props.children
 * @returns {Fragment}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 */
const OrFormula = ({ setProp, isFormula, node, nodekey, children }) => {
  const { mode } = React.useContext(optionsCtx);
  const allowFormula = mode === "show" || mode === "list";
  /**
   * @returns {void}
   */
  const switchIsFml = () => {
    const isFmlAfter = !isFormula[nodekey];
    setProp((prop) => {
      prop.isFormula[nodekey] = isFmlAfter;
      if (isFmlAfter && prop[nodekey] && prop[nodekey][0] !== '"') {
        prop[nodekey] = `"${prop[nodekey]}"`;
      } else if (
        !isFmlAfter &&
        typeof prop[nodekey] === "string" &&
        prop[nodekey][0] === '"' &&
        prop[nodekey][prop[nodekey].length - 1] === '"'
      ) {
        prop[nodekey] = prop[nodekey].substring(1, prop[nodekey].length - 1);
      }
    });
  };
  let errorString = false;
  if (allowFormula && isFormula[nodekey]) {
    try {
      Function("return " + node[nodekey]);
    } catch (error) {
      errorString = error.message;
    }
  }
  return !allowFormula ? (
    children
  ) : (
    <Fragment>
      <div className="input-group  input-group-sm w-100">
        {isFormula[nodekey] ? (
          <input
            type="text"
            className="form-control text-to-display"
            value={node[nodekey] || ""}
            spellCheck={false}
            onChange={(e) => {
              if (e.target) {
                const target_value = e.target.value;
                setProp((prop) => (prop[nodekey] = target_value));
              }
            }}
          />
        ) : (
          children
        )}

        <button
          className={`btn activate-formula ${
            isFormula[nodekey] ? "btn-secondary" : "btn-outline-secondary"
          }`}
          title="Calculated formula"
          type="button"
          onClick={switchIsFml}
        >
          <i className="fas fa-calculator"></i>
        </button>
      </div>
      {isFormula[nodekey] && (
        <div style={{ marginTop: "-5px" }}>
          <small className="text-muted font-monospace">
            FORMULA
            <FormulaTooltip />
          </small>
          {errorString ? (
            <small className="text-danger font-monospace d-block">
              {errorString}
            </small>
          ) : null}
        </div>
      )}
    </Fragment>
  );
};

export /**
 * @param {object} props
 * @param {string} props.minRole
 * @param {function} props.setProp
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 */
const MinRoleSetting = ({ minRole, setProp }) => {
  const options = React.useContext(optionsCtx);
  return (
    <div>
      <label>Minimum Role</label>
      <select
        className="form-control form-select"
        value={minRole}
        onChange={(e) => (e) => {
          if (e.target) {
            const target_value = e.target.value;
            setProp((prop) => (prop.minRole = target_value));
          }
        }}
      >
        {options.roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.role}
          </option>
        ))}
      </select>
    </div>
  );
};

export /**
 * @param {object} props
 * @param {string} props.minRole
 * @param {function} props.setProp
 * @returns {tr}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 */
const MinRoleSettingRow = ({ minRole, setProp }) => {
  const options = React.useContext(optionsCtx);
  return (
    <tr>
      <td>
        <label>Minimum Role</label>
      </td>
      <td>
        <select
          value={minRole}
          className="form-control form-select"
          onChange={(e) => {
            if (e.target) {
              const target_value = e.target.value;
              setProp((prop) => (prop.minRole = target_value));
            }
          }}
        >
          {options.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.role}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
};

/**
 * @param {object} props
 * @param {string} props.textStyle
 * @param {function} props.setProp
 * @returns {select}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 */
const TextStyleSelect = ({ textStyle, setProp }) => {
  return (
    <select
      value={textStyle}
      className="form-control form-select"
      onChange={(e) => {
        if (e.target) {
          const target_value = e.target.value;
          setProp((prop) => (prop.textStyle = target_value));
        }
      }}
    >
      <option value="">Normal</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
      <option value="fw-bold">Bold</option>
      <option value="fst-italic">Italics</option>
      <option value="small">Small</option>
      <option value="text-muted">Muted</option>
      <option value="text-underline">Underline</option>
      <option value="font-monospace">Monospace</option>
    </select>
  );
};
const textStyleToArray = (textStyle) =>
  Array.isArray(textStyle) ? textStyle : !textStyle ? [] : [textStyle];

const TextStyleSelectBtns = ({ textStyle, setProp }) => {
  const styleArray = textStyleToArray(textStyle);
  const clickH = (h) => {
    const noH = styleArray.filter((s) => !(s.length == 2 && s[0] === "h"));
    const selected = styleArray.includes(`h${h}`);
    if (!selected) noH.push(`h${h}`);
    setProp((prop) => (prop.textStyle = noH));
  };
  const clickStyle = (style) => {
    const noH = styleArray.filter((s) => s !== style);
    const selected = styleArray.includes(style);
    if (!selected) noH.push(style);
    setProp((prop) => (prop.textStyle = noH));
  };
  const StyleButton = ({ styleName, icon, title, size }) => (
    <button
      type="button"
      title={title}
      onClick={() => clickStyle(styleName)}
      className={`btn btn-sm btn-${
        !styleArray.includes(styleName) ? "outline-" : ""
      }secondary style-${styleName}`}
    >
      <FontAwesomeIcon icon={icon} size={size || undefined} />
    </button>
  );

  return (
    <div>
      <div className="btn-group w-100" role="group">
        {[1, 2, 3, 4, 5, 6].map((h) => (
          <button
            key={h}
            type="button"
            title={`Heading ${h}`}
            onClick={() => clickH(h)}
            className={`btn btn-sm btn-${
              !styleArray.includes(`h${h}`) ? "outline-" : ""
            }secondary style-h${h}`}
          >
            H{h}
          </button>
        ))}
      </div>
      <div className="btn-group w-100" role="group">
        <StyleButton
          styleName="fw-bold"
          icon={faBold}
          title="Bold"
        ></StyleButton>
        <StyleButton
          styleName="fst-italic"
          icon={faItalic}
          title="Italics"
        ></StyleButton>
        <StyleButton
          styleName="small"
          icon={faFont}
          title="Small"
          size="xs"
        ></StyleButton>
        <StyleButton
          styleName="text-muted"
          icon={faCommentSlash}
          title="Muted"
        ></StyleButton>
        <StyleButton
          styleName="text-underline"
          icon={faUnderline}
          title="Underline"
        ></StyleButton>
        <StyleButton
          styleName="font-monospace"
          icon={faTerminal}
          title="Monospace"
        ></StyleButton>
      </div>
    </div>
  );
};

export /**
 * @param {object} props
 * @param {string} props.textStyle
 * @param {function} props.setProp
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 */
const TextStyleSetting = ({ textStyle, setProp }) => {
  return (
    <div>
      <label>Text Style</label>
      <TextStyleSelect textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

export /**
 * @param {object} props
 * @param {string} props.textStyle
 * @param {function} props.setProp
 * @returns {tr}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 */
const TextStyleRow = ({ textStyle, setProp }) => {
  return (
    <tr>
      <td colSpan={2}>
        <TextStyleSelectBtns textStyle={textStyle} setProp={setProp} />
      </td>
    </tr>
  );
};

export /**
 * @param {object} props
 * @param {string[]} [props.titles]
 * @param {object[]} props.children
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const Accordion = ({ titles, children }) => {
  const [currentTab, setCurrentTab] = useState(0);
  return (
    <Fragment>
      {children.map((child, ix) => {
        const isCurrent = ix === currentTab;
        return (
          <Fragment key={ix}>
            <div
              className={`bg-${
                isCurrent ? "primary" : "secondary"
              } ps-1 text-white w-100 mt-1`}
              onClick={() => setCurrentTab(ix)}
            >
              <span className="w-1em">
                {isCurrent ? (
                  <FontAwesomeIcon icon={faChevronDown} />
                ) : (
                  <FontAwesomeIcon icon={faChevronRight} />
                )}
              </span>
              {child.props.accordiontitle || titles[ix]}
            </div>
            {isCurrent ? child : null}
          </Fragment>
        );
      })}
    </Fragment>
  );
};

/**
 * @param {object} opts
 * @param {string} opts.url
 * @param {object} opts.body
 * @param {object} opts.options
 * @param {function} opts.setPreviews
 * @param {*} opts.node_id
 * @param {boolean} opts.isView
 * @returns {void}
 */
const fetchPreview = ({ url, body, options, setPreviews, node_id, isView }) => {
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CSRF-Token": options.csrfToken,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  })
    .then(function (response) {
      if (response.status < 399) return response.text();
      else return "";
    })
    .then(function (html) {
      $(".preview-scratchpad").html(html);
      $(".preview-scratchpad").find("iframe").css("pointer-events", "none");
      $(".preview-scratchpad").find("a").attr("href", "#");
      $(".preview-scratchpad")
        .find("[onclick], button, a, input, select")
        .attr("onclick", "return false");

      //.attr("disabled", true);
      $(".preview-scratchpad").find("textarea").attr("readonly", true);
      $(".preview-scratchpad .full-page-width").removeClass("full-page-width");
      if (isView) {
        $(".preview-scratchpad").find("input").attr("readonly", true);
      }
      const newHtml = $(".preview-scratchpad").html();
      setPreviews((prevState) => ({ ...prevState, [node_id]: newHtml }));
    })
    .catch((e) => {
      console.log("Unable to fetch the preview:");
      console.log(e);
    });
};

/**
 * @function
 * @param {object} [args = {}]
 * @return {function}
 */
export const fetchFieldPreview =
  (args = {}) =>
  (changes = {}) => {
    const { node_id, options, name, fieldview, setPreviews } = {
      ...args,
      ...changes,
    };
    const configuration = {
      ...(args.configuration || {}),
      ...(changes.configuration || {}),
    };
    fetchPreview({
      options,
      node_id,
      setPreviews,
      url: `/field/preview/${options.tableName}/${name}/${fieldview}`,
      body: { configuration },
    });
  };

/**
 * @function
 * @param {object} [args = {}]
 * @return {function}
 */
export const fetchViewPreview =
  (args = {}) =>
  (changes = {}) => {
    const { node_id, options, view, setPreviews, configuration } = {
      ...args,
      ...changes,
    };
    let viewname,
      body = configuration ? { ...configuration } : {};
    if (!view) return "";
    if (view.includes(":")) {
      const [prefix, rest] = view.split(":");
      const tokens = rest.split(".");
      if (rest.startsWith(".")) {
        viewname = prefix;
      } else {
        viewname = tokens[0];
        body.reltype = prefix;
        body.path = rest;
      }
    } else viewname = view;

    fetchPreview({
      options,
      node_id,
      setPreviews,
      url: `/view/${viewname}/preview`,
      body,
      isView: true,
    });
  };

export const fetchPagePreview =
  (args = {}) =>
  (changes = {}) => {
    const { node_id, options, page, setPreviews } = {
      ...args,
      ...changes,
    };
    fetchPreview({
      options,
      node_id,
      setPreviews,
      url: `/page/${page}/preview`,
      body: {},
      isView: true, // disables inputs
    });
  };

export /**
 * @param {object} props
 * @param {boolean} props.vert
 * @param {string} [props.autoable]
 * @param {...*} props.props
 * @returns {select}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const SelectUnits = ({ vert, autoable, ...props }) => {
  const options = ["px", "%", vert ? "vh" : "vw", "em", "rem", "cm"];
  if (autoable) options.push("auto");
  return <select {...props}>{buildOptions(options)}</select>;
};

/**
 * @function
 * @param {string} [styles]
 * @returns {string}
 */
export const parseStyles = (styles) =>
  (styles || "")
    .split("\n")
    .join("")
    .split(";")
    .filter((style) => style.split(":")[0] && style.split(":")[1])
    .map((style) => [
      style
        .split(":")[0]
        .trim()
        .replace(/-./g, (c) => c.substr(1).toUpperCase()),
      style.split(":")[1].trim(),
    ])
    .reduce(
      (styleObj, style) => ({
        ...styleObj,
        [style[0]]: style[1],
      }),
      {}
    );

/**
 * @function
 * @param {object} styles
 * @returns {object}
 */
export const reactifyStyles = (styles, transform, rotate) => {
  const toCamel = (s) => {
    return s.replace(/([-][a-z])/gi, ($1) => {
      return $1.toUpperCase().replace("-", "");
    });
  };
  const reactified = {};
  Object.keys(styles).forEach((k) => {
    reactified[toCamel(k)] = styles[k];
  });
  if (transform) {
    reactified.transform = Object.entries(transform)
      .filter(([k, v]) => v !== "")
      .map(([k, v]) => `${k}(${v})`)
      .join(" ");
  }
  if (rotate) {
    if (!reactified.transform) reactified.transform = `rotate(${rotate}deg)`;
    else reactified.transform = `${reactified.transform} rotate(${rotate}deg)`;
  }

  return reactified;
};

/**
 * @param {object} f
 * @returns {boolean}
 */
const isCheckbox = (f) =>
  f && f.type && (f.type === "Bool" || f.type.name === "Bool");

/**
 * @function
 * @param {function} setProp
 * @param {*} fieldview
 * @param {object[]} [fields]
 * @returns {void}
 */
export const setInitialConfig = (setProp, fieldview, fields) => {
  (fields || []).forEach((f, ix) => {
    if (f.input_type === "select")
      setProp((prop) => {
        if (!prop.configuration[f.name])
          prop.configuration[f.name] = f.options[0] || "";
      });
  });
};

/**
 * @param {object} props
 * @param {string} props.value
 * @param {function} props.onChange
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 * @returns {input|button}
 */
const ColorInput = ({ value, onChange }) =>
  value ? (
    <input
      type="color"
      value={value}
      className="form-control"
      onChange={(e) => e.target && onChange(e.target.value)}
    />
  ) : (
    <button
      className="btn btn-sm btn-outline-secondary"
      onClick={() => onChange("#000000")}
    >
      <small>Set color</small>
    </button>
  );

export /**
 * @param {object} props
 * @param {object[]} props.fields
 * @param {object} props.configuration
 * @param {function} props.setProp
 * @param {object} props.node
 * @param {function} props.onChange
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const ConfigForm = ({
  fields,
  configuration,
  setProp,
  setter,
  node,
  onChange,
  tableName,
  fieldName,
}) => (
  <div>
    {fields.map((f, ix) => {
      if (f.showIf && configuration) {
        let noshow = false;
        Object.entries(f.showIf).forEach(([nm, value]) => {
          if (Array.isArray(value))
            noshow = noshow || !value.includes(configuration[nm]);
          else noshow = noshow || value !== configuration[nm];
        });
        if (noshow) return null;
      }
      return (
        <div key={ix} className="builder-config-field" data-field-name={f.name}>
          {!isCheckbox(f) ? (
            <label>
              {f.label || f.name}
              {f.help ? (
                <HelpTopicLink
                  topic={f.help.topic}
                  field_name={fieldName}
                  table_name={tableName}
                />
              ) : null}
            </label>
          ) : null}
          <ConfigField
            field={f}
            setter={setter}
            configuration={configuration}
            setProp={setProp}
            onChange={onChange}
          />
          {f.sublabel ? (
            <i
              className="small"
              dangerouslySetInnerHTML={{ __html: f.sublabel }}
            ></i>
          ) : null}
          {isCheckbox(f) && f.help ? (
            <HelpTopicLink
              topic={f.help.topic}
              fieldName={fieldName}
              tableName={tableName}
            />
          ) : null}
        </div>
      );
    })}
    <br />
  </div>
);

/**
 * @param {object|undefined} x
 * @param {object} y
 * @returns {object}
 */
const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);

export /**
 * @param {object} props
 * @param {object} props.field
 * @param {object} [props.configuration]
 * @param {function} props.setProp
 * @param {function} props.onChange
 * @param {object} props.props
 * @param {boolean} props.isStyle
 * @returns {select|input}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const ConfigField = ({
  field,
  configuration,
  setProp,
  onChange,
  props,
  setter,
  isStyle,
  subProp,
  valuePostfix,
}) => {
  /**
   * @param {object} v
   * @returns {void}
   */
  const options = React.useContext(optionsCtx);

  const myOnChange = (v0) => {
    const v = valuePostfix && (v0 || v0 === 0) ? v0 + valuePostfix : v0;
    setProp((prop) => {
      if (setter) setter(prop, field.name, v);
      else if (configuration) {
        if (!prop.configuration) prop.configuration = {};
        prop.configuration[field.name] = v;
      } else if (isStyle) {
        if (!prop.style) prop.style = {};
        prop.style[field.name] = v;
      } else if (subProp) {
        if (!prop[subProp]) prop[subProp] = {};
        prop[subProp][field.name] = v;
      } else prop[field.name] = v;
    });
    onChange && onChange(field.name, v, setProp);
  };
  let stored_value = configuration
    ? configuration[field.name]
    : isStyle
      ? props.style[field.name]
      : subProp
        ? props[subProp]?.[field.name]
        : props[field.name];

  let value = or_if_undef(stored_value, field.default);
  if (valuePostfix)
    value = `${value}`.replaceAll(valuePostfix || "__nosuchstring", "");
  if (field.input_type === "fromtype") field.input_type = null;
  if (
    field.type &&
    (field.type.name === "String" || field.type === "String") &&
    field.attributes?.options
  ) {
    field.input_type = "select";
    field.options =
      typeof field.attributes?.options === "string"
        ? field.attributes?.options.split(",").map((s) => s.trim())
        : [...field.attributes?.options];
    if (!field.required && field.options) field.options.unshift("");
  }
  const field_type = field.input_type || field.type.name || field.type;
  const hasSelect =
    (field_type === "String" && field.attributes?.options) ||
    field_type === "select";
  const getOptions = () =>
    typeof field?.attributes?.options === "string"
      ? field.attributes?.options.split(",").map((s) => s.trim())
      : field?.attributes?.options || field.options;
  if (
    typeof field.default !== "undefined" &&
    typeof stored_value === "undefined"
  ) {
    useEffect(() => {
      myOnChange(field.default);
    }, []);
  } else if (hasSelect && typeof value === "undefined") {
    //pick first value to mimic html form behaviour
    const options = getOptions();
    let o;
    if (options && (o = options[0]))
      useEffect(() => {
        myOnChange(typeof o === "string" ? o : o.value || o.name || o);
      }, []);
  }

  const dispatch = {
    String() {
      if (field.attributes?.options) {
        const options = getOptions();
        return (
          <select
            className={`field-${field?.name} form-control form-select`}
            value={value || ""}
            onChange={(e) => e.target && myOnChange(e.target.value)}
            onBlur={(e) => e.target && myOnChange(e.target.value)}
          >
            {options.map((o, ix) => (
              <option
                key={ix}
                value={typeof o === "string" ? o : o.value || o.name}
              >
                {typeof o === "string" ? o : o.label}
              </option>
            ))}
          </select>
        );
      } else
        return (
          <input
            type="text"
            className={`field-${field?.name} form-control`}
            value={value || ""}
            spellCheck={false}
            onChange={(e) => e.target && myOnChange(e.target.value)}
          />
        );
    },
    Font: () => (
      <select
        className="fontselect form-control form-select"
        value={value || ""}
        onChange={(e) => e.target && myOnChange(e.target.value)}
        onBlur={(e) => e.target && myOnChange(e.target.value)}
      >
        <option value={""}></option>
        {Object.entries(options.fonts || {})
          .sort()
          .map(([nm, ff], ix) => (
            <option key={ix} value={ff}>
              {nm}
            </option>
          ))}
      </select>
    ),
    Integer: () => (
      <input
        type="number"
        className={`field-${field?.name} form-control`}
        step={field.step || 1}
        min={field.min}
        max={field.max}
        value={value || ""}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      />
    ),
    Float: () => (
      <input
        type="number"
        className={`field-${field?.name} form-control`}
        value={value || ""}
        step={0.01}
        max={or_if_undef(field?.attributes?.max, undefined)}
        min={or_if_undef(field?.attributes?.min, undefined)}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      />
    ),
    Color: () => <ColorInput value={value} onChange={(c) => myOnChange(c)} />,
    Bool: () => (
      <div className="form-check">
        <input
          type="checkbox"
          className={`field-${field?.name} form-check-input`}
          checked={value}
          onChange={(e) => e.target && myOnChange(e.target.checked)}
        />
        <label className="form-check-label">{field.label}</label>
      </div>
    ),
    textarea: () => (
      <textarea
        rows="6"
        type="text"
        className={`field-${field?.name} form-control`}
        value={value}
        spellCheck={false}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      />
    ),
    code: () => (
      <textarea
        rows="6"
        type="text"
        className={`field-${field?.name} form-control`}
        value={value}
        onChange={(e) => e.target && myOnChange(e.target.value)}
        spellCheck={false}
      />
    ),
    select: () => {
      if (field.class?.includes?.("selectizable")) {
        const seloptions = field.options.map((o, ix) =>
          o.name && o.label
            ? { value: o.name, label: o.label }
            : o.value && o.label
              ? { value: o.value, label: o.label }
              : { value: o, label: o }
        );
        return (
          <Select
            options={seloptions}
            value={seloptions.find((so) => value === so.value)}
            onChange={(e) =>
              (e.name && myOnChange(e.name)) ||
              (e.value && myOnChange(e.value)) ||
              (typeof e === "string" && myOnChange(e))
            }
            onBlur={(e) =>
              (e.name && myOnChange(e.name)) ||
              (e.value && myOnChange(e.value)) ||
              (typeof e === "string" && myOnChange(e))
            }
            menuPortalTarget={document.body}
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 19999 }) }}
          ></Select>
        );
      } else
        return (
          <select
            className={`field-${field?.name} form-control form-select`}
            value={value || ""}
            onChange={(e) => e.target && myOnChange(e.target.value)}
            onBlur={(e) => e.target && myOnChange(e.target.value)}
          >
            {(field.options || []).map((o, ix) =>
              o.name && o.label ? (
                <option key={ix} value={o.name}>
                  {o.label}
                </option>
              ) : o.value && o.label ? (
                <option key={ix} value={o.value}>
                  {o.label}
                </option>
              ) : (
                <option key={ix}>{o}</option>
              )
            )}
          </select>
        );
    },
    btn_select: () => (
      <div className="btn-group w-100" role="group">
        {field.options.map((o, ix) => (
          <button
            key={ix}
            title={o.title || o.value}
            type="button"
            style={{ width: `${Math.floor(100 / field.options.length)}%` }}
            className={`field-${field?.name} btn btn-sm btn-${
              value !== o.value ? "outline-" : ""
            }secondary ${field.btnClass || ""}`}
            onClick={() => myOnChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    ),
    DimUnits: () => {
      let styleVal, styleDim;
      if (isStyle && value === "auto") {
        styleVal = "";
        styleDim = "auto";
      } else if ((isStyle || subProp) && value && typeof value === "string") {
        const matches = value.match(/^([-]?[0-9]+\.?[0-9]*)(.*)/);
        if (matches) {
          styleVal = matches[1];
          styleDim = matches[2];
        }
      }
      return (
        <Fragment>
          {styleDim !== "auto" && (
            <input
              type="number"
              value={(isStyle || subProp ? styleVal : value) || ""}
              className={`field-${field?.name} w-50 form-control-sm d-inline dimunit`}
              disabled={field.autoable && styleDim === "auto"}
              onChange={(e) =>
                e?.target &&
                myOnChange(
                  isStyle || subProp
                    ? `${e.target.value}${styleDim || "px"}`
                    : e.target.value
                )
              }
            />
          )}
          <SelectUnits
            value={or_if_undef(
              configuration
                ? configuration[field.name + "Unit"]
                : isStyle || subProp
                  ? styleDim
                  : props[field.name + "Unit"],
              "px"
            )}
            autoable={field.autoable}
            className={`field-${field?.name} w-${
              styleDim === "auto" ? 100 : 50
            } form-control-sm d-inline dimunit`}
            vert={!field.horiz}
            onChange={(e) => {
              if (!e.target) return;
              const target_value = e.target.value;
              setProp((prop) => {
                const myStyleVal =
                  target_value === "auto" && field.autoable && isStyle
                    ? ""
                    : styleVal;
                if (configuration)
                  prop.configuration[field.name + "Unit"] = target_value;
                else if (isStyle) {
                  prop.style[field.name] = `${or_if_undef(
                    myStyleVal,
                    0
                  )}${target_value}`;
                }
                if (subProp) {
                  if (!prop[subProp]) prop[subProp] = {};
                  prop[subProp][field.name] = `${or_if_undef(
                    myStyleVal,
                    0
                  )}${target_value}`;
                } else prop[field.name + "Unit"] = target_value;
              });
            }}
          />
        </Fragment>
      );
    },
  };
  const f = dispatch[field_type];
  return f ? f() : null;
};

export /**
 * @param {object[]} fields
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 * @returns {table}
 */
const SettingsFromFields =
  (fieldsIn, opts = {}) =>
  () => {
    const fields = [...fieldsIn];
    if (opts.additionalFieldsOptionKey) {
      const options = React.useContext(optionsCtx);

      const addFields = options[opts.additionalFieldsOptionKey];
      fields.push(...(addFields || []));
    }
    const node = useNode((node) => {
      const ps = {};
      fields.forEach((f) => {
        ps[f.name] = node.data.props[f.name];
      });
      if (fields.some((f) => f.canBeFormula))
        ps.isFormula = node.data.props.isFormula;
      return ps;
    });
    const {
      actions: { setProp },
    } = node;
    const noop = () => {};
    return (
      <table className="w-100">
        <tbody>
          {fields.map((f, ix) => {
            if (f.showIf) {
              let noshow = false;
              Object.entries(f.showIf).forEach(([nm, value]) => {
                if (Array.isArray(value))
                  noshow = noshow || !value.includes(node[nm]);
                else noshow = noshow || value !== node[nm];
              });
              if (noshow) return null;
            }
            return (
              <SettingsRow
                field={f}
                key={ix}
                node={node}
                onChange={opts.onChange || noop}
                setProp={setProp}
              />
            );
          })}
        </tbody>
      </table>
    );
  };

export /**
 * @param {object} props
 * @param {string} props.title
 * @returns {tr}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const SettingsSectionHeaderRow = ({ title }) => (
  <tr>
    <th colSpan="2">{title}</th>
  </tr>
);

export /**
 * @param {object} props
 * @param {string} props.field
 * @param {object} props.node
 * @param {function} props.setProp
 * @param {function} props.onChange
 * @param {boolean} props.isStyle
 * @returns {tr}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const SettingsRow = ({
  field,
  node,
  setProp,
  onChange,
  isStyle,
  subProp,
  valuePostfix,
}) => {
  const fullWidth = ["String", "Bool", "textarea"].includes(field.type);
  const needLabel = field.type !== "Bool";
  const inner = field.canBeFormula ? (
    <OrFormula
      nodekey={field.name}
      isFormula={node.isFormula}
      {...{ setProp, node }}
    >
      <ConfigField
        field={field}
        props={node}
        setProp={setProp}
        onChange={onChange}
      />
    </OrFormula>
  ) : (
    <ConfigField
      field={field}
      props={node}
      setProp={setProp}
      onChange={onChange}
      isStyle={isStyle}
      subProp={subProp}
      valuePostfix={valuePostfix}
    />
  );
  return (
    <tr>
      {fullWidth ? (
        <td colSpan="2">
          {needLabel && <label>{field.label}</label>}
          {inner}
          {field.sublabel ? (
            <i
              className="small"
              dangerouslySetInnerHTML={{ __html: field.sublabel }}
            ></i>
          ) : null}
        </td>
      ) : (
        <Fragment>
          <td>
            <label>{field.label}</label>
          </td>
          <td>
            {inner}
            {field.sublabel ? (
              <i
                className="small"
                dangerouslySetInnerHTML={{ __html: field.sublabel }}
              ></i>
            ) : null}
          </td>
        </Fragment>
      )}
    </tr>
  );
};

/**
 * @category saltcorn-builder
 * @extends React.Component
 */
export class ErrorBoundary extends React.Component {
  /**
   * ErrorBoundary constructor
   * @param {object} props
   */
  constructor(props) {
    super(props);
    this.state = { hasError: false, reported: false };
  }

  /**
   * @param {*} error
   * @returns {object}
   */
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  /**
   * @param {object} error
   * @param {object} errorInfo
   * @returns {void}
   */
  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    //logErrorToMyService(error, errorInfo);
    console.error(error);

    if (!this.state.reported) {
      const data = {
        message: error.message,
        stack: (error && error.stack) || "",
      };

      fetch("/crashlog/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": _sc_globalCsrf,
        },
        body: JSON.stringify(data),
      });
      this.setState({ reported: true });
    }
  }

  /**
   * @returns {object}
   */
  render() {
    return this.props.children;
  }
}

export /**
 * @param {object} props
 * @param {function} props.setProp
 * @param {string} [props.btnClass = null]
 * @param {string} [props.keyPrefix = ""]
 * @param {object} props.values
 * @param {boolean} [props.linkFirst = false]
 * @returns {tr}
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 */
const ButtonOrLinkSettingsRows = ({
  setProp,
  btnClass = null,
  keyPrefix = "",
  values,
  linkFirst = false,
  linkIsBlank = false,
  allowRunOnLoad = false,
  faIcons = [],
}) => {
  const setAProp = setAPropGen(setProp);
  const addBtnClass = (s) => (btnClass ? `${btnClass} ${s}` : s);
  return [
    <tr key="btnstyle">
      <td>
        <label>Style</label>
      </td>
      <td>
        <select
          className="form-control form-select"
          value={values[keyPrefix + "style"]}
          onChange={setAProp(keyPrefix + "style")}
        >
          {linkFirst ? (
            <option value={linkIsBlank ? "" : addBtnClass("btn-link")}>
              Link
            </option>
          ) : null}
          <option value={addBtnClass("btn-primary")}>Primary button</option>
          <option value={addBtnClass("btn-secondary")}>Secondary button</option>
          <option value={addBtnClass("btn-success")}>Success button</option>
          <option value={addBtnClass("btn-danger")}>Danger button</option>
          <option value={addBtnClass("btn-warning")}>Warning button</option>
          <option value={addBtnClass("btn-info")}>Info button</option>
          <option value={addBtnClass("btn-outline-primary")}>
            Primary outline button
          </option>
          <option value={addBtnClass("btn-outline-secondary")}>
            Secondary outline button
          </option>
          <option value={addBtnClass("btn-outline-success")}>
            Success outline button
          </option>
          <option value={addBtnClass("btn-outline-danger")}>
            Danger outline button
          </option>
          <option value={addBtnClass("btn-outline-warning")}>
            Warning outline button
          </option>
          <option value={addBtnClass("btn-outline-info")}>
            Info outline button
          </option>
          <option value={addBtnClass("btn-custom-color")}>
            Button custom color
          </option>
          {!linkFirst ? (
            <option value={addBtnClass("btn-link")}>Link</option>
          ) : null}
          {!linkFirst && allowRunOnLoad ? (
            <option value="on_page_load">Run on Page Load</option>
          ) : null}
        </select>
      </td>
    </tr>,
    values[keyPrefix + "style"] !== "on_page_load" ? (
      <tr key="btnsz">
        <td>
          <label>Size</label>
        </td>
        <td>
          <select
            className="form-control form-select"
            value={values[keyPrefix + "size"]}
            onChange={setAProp(keyPrefix + "size")}
          >
            <option value="">Standard</option>
            <option value="btn-lg">Large</option>
            <option value="btn-sm">Small</option>
            <option value="btn-sm btn-xs">Extra Small</option>
            <option value="btn-block">Block</option>
            <option value="btn-block btn-lg">Large block</option>
          </select>
        </td>
      </tr>
    ) : null,
    values[keyPrefix + "style"] !== "on_page_load" ? (
      <tr key="btnicon">
        <td>
          <label>Icon</label>
        </td>
        <td>
          <FontIconPicker
            value={values[keyPrefix + "icon"]}
            onChange={(value) =>
              setProp((prop) => (prop[keyPrefix + "icon"] = value))
            }
            isMulti={false}
            icons={faIcons || []}
          />
        </td>
      </tr>
    ) : null,
    ...(values[keyPrefix + "style"] === addBtnClass("btn-custom-color")
      ? [
          <tr key="btnbgcol">
            <td>
              <label>Background</label>
            </td>
            <td>
              <input
                type="color"
                value={values[keyPrefix + "bgcol"]}
                className="form-control-sm w-50"
                onChange={setAProp(keyPrefix + "bgcol")}
              />
            </td>
          </tr>,
          <tr key="btnbdcol">
            <td>
              <label>Border</label>
            </td>
            <td>
              <input
                type="color"
                value={values[keyPrefix + "bordercol"]}
                className="form-control-sm w-50"
                onChange={setAProp(keyPrefix + "bordercol")}
              />
            </td>
          </tr>,
          <tr key="btntxtcol">
            <td>
              <label>Text</label>
            </td>
            <td>
              <input
                type="color"
                value={values[keyPrefix + "textcol"]}
                className="form-control-sm w-50"
                onChange={setAProp(keyPrefix + "textcol")}
              />
            </td>
          </tr>,
        ]
      : []),
    values[keyPrefix + "style"] !== "on_page_load" ? (
      <Fragment>
        <tr key="btntitle">
          <td>
            <label>Hover title</label>
          </td>
          <td>
            <input
              className="form-control linkoractiontitle"
              value={values[keyPrefix + "title"]}
              onChange={setAProp(keyPrefix + "title")}
            />
          </td>
        </tr>
        <tr key="btnclass">
          <td>
            <label>Class</label>
          </td>
          <td>
            <input
              className="form-control linkoractionclass"
              value={values[keyPrefix + "class"]}
              onChange={setAProp(keyPrefix + "class")}
            />
          </td>
        </tr>
      </Fragment>
    ) : null,
  ];
};

/**
 * @function
 * @param {string} style
 * @returns {object}
 */
export const bstyleopt = (style) => ({
  value: style,
  title: style,
  label: (
    <div
      style={{
        borderLeftStyle: style,
        borderTopStyle: style,
        height: "15px",
        width: "6px",
      }}
    ></div>
  ),
});

export const rand_ident = () =>
  Math.floor(Math.random() * 16777215).toString(16);

export const isBlock = (block, inline, textStyle) =>
  !textStyle ||
  !textStyleToArray(textStyle).some((ts) => ts && ts.startsWith("h"))
    ? block
    : !inline;

export const setAPropGen =
  (setProp) =>
  (key, opts = {}) =>
  (e) => {
    if (e.target) {
      const target_value = opts?.checked ? e.target.checked : e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };

const Tooltip = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const show = () => setVisible(true);
  const hide = () => setVisible(false);
  return (
    <Tippy
      content={children}
      visible={visible}
      onClickOutside={hide}
      interactive={true}
    >
      <span onClick={visible ? hide : show} className="ms-1">
        <FontAwesomeIcon icon={faInfoCircle} />
      </span>
    </Tippy>
  );
};

export const removeWhitespaces = (str) => {
  return str.replace(/\s/g, "X");
};

/**
 *
 * @param {string} string
 * @returns {string}
 */
export const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export const buildOptions = (
  options,
  { valAttr, keyAttr, capitalize } = {}
) => {
  return options.map((option, ix) => (
    <option
      key={ix}
      {...(valAttr ? { value: option } : {})}
      {...(keyAttr ? { key: option } : {})}
    >
      {capitalize ? capitalizeFirstLetter(option) : option}
    </option>
  ));
};

export const buildBootstrapOptions = (values) => {
  const mappings = {
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "x-large",
  };
  return values.map((option, ix) => (
    <option key={ix} value={option}>
      {mappings[option]}
    </option>
  ));
};

export const arrayChunks = (xs, n) => {
  const arrayOfArrays = [];
  for (var i = 0; i < bigarray.length; i += n) {
    arrayOfArrays.push(bigarray.slice(i, i + n));
  }
  return arrayOfArrays;
};

/**
 * @param {string[]} relations
 * @param {string} sourceTbl name of the topview table
 * @returns either a same table relation, a parent relation, a child relation, or the first relation
 */
export const initialRelation = (relations) => {
  let sameTblRel = null;
  let parentRel = null;
  let childRel = null;
  for (const relation of relations) {
    switch (relation.type) {
      case RelationType.OWN:
        sameTblRel = relation;
        break;
      case RelationType.PARENT_SHOW:
        parentRel = relation;
        break;
      case RelationType.CHILD_LIST:
      case RelationType.ONE_TO_ONE_SHOW:
        childRel = relation;
        break;
    }
  }
  return sameTblRel || parentRel || childRel || relations[0];
};

/**
 * builder intern path method
 * @param path
 * @param tableNameCache
 * @returns
 */
export const buildRelationArray = (path, tableNameCache) => {
  if (path === ".")
    return [{ type: "Independent", table: "None (no relation)" }];
  const tokens = path.split(".");
  if (tokens.length === 2)
    return [{ type: "Own", table: `${tokens[1]} (same table)` }];
  else if (tokens.length >= 3) {
    const result = [];
    let currentTbl = tokens[1];
    for (const relation of tokens.slice(2)) {
      if (relation.indexOf("$") > 0) {
        const [inboundTbl, inboundKey] = relation.split("$");
        result.push({ type: "Inbound", table: inboundTbl, key: inboundKey });
        currentTbl = inboundTbl;
      } else {
        const srcTbl = tableNameCache[currentTbl];
        const fk = srcTbl.foreign_keys.find((fk) => fk.name === relation);
        if (fk) {
          const targetTbl = tableNameCache[fk.reftable_name];
          result.push({
            type: "Foreign",
            table: targetTbl.name,
            key: relation,
          });
          currentTbl = targetTbl.name;
        }
      }
    }
    return result;
  }
};

export const buildLayers = (relations, tableName, tableNameCache) => {
  const result = { table: tableName, inboundKeys: [], fkeys: [] };
  for (const relation of relations) {
    const relType = relation.type;
    let currentLevel = result;
    if (relType === RelationType.INDEPENDENT) {
      currentLevel.fkeys.push({
        name: "none (no relation)",
        table: "",
        inboundKeys: [],
        fkeys: [],
        relPath: relation.relationString,
      });
    } else if (relType === RelationType.OWN) {
      currentLevel.fkeys.push({
        name: "same table",
        table: relation.targetTblName,
        inboundKeys: [],
        fkeys: [],
        relPath: relation.relationString,
      });
    } else {
      let currentTbl = relation.sourceTblName;
      for (const pathElement of relation.path) {
        if (pathElement.inboundKey) {
          currentTbl = pathElement.table;
          const existing = currentLevel.inboundKeys.find(
            (key) =>
              key.name === pathElement.inboundKey && key.table === currentTbl
          );
          if (existing) {
            currentLevel = existing;
          } else {
            const nextLevel = {
              name: pathElement.inboundKey,
              table: currentTbl,
              inboundKeys: [],
              fkeys: [],
            };
            currentLevel.inboundKeys.push(nextLevel);
            currentLevel = nextLevel;
          }
        } else if (pathElement.fkey) {
          const tblObj = tableNameCache[currentTbl];
          const fkey = tblObj.foreign_keys.find(
            (key) => key.name === pathElement.fkey
          );
          currentTbl = fkey.reftable_name;
          const existing = currentLevel.fkeys.find(
            (key) => key.name === pathElement.fkey
          );
          if (existing) {
            currentLevel = existing;
          } else {
            const nextLevel = {
              name: pathElement.fkey,
              table: currentTbl,
              inboundKeys: [],
              fkeys: [],
            };
            currentLevel.fkeys.push(nextLevel);
            currentLevel = nextLevel;
          }
        }
      }
    }
    currentLevel.relPath = relation.relationString;
  }
  return result;
};
