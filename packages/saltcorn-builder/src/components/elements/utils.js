/**
 * @category saltcorn-builder
 * @module components/elements/utils
 * @subcategory components / elements
 */

import React, { Fragment, useContext, useState } from "react";
import optionsCtx from "../context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useNode, Element } from "@craftjs/core";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import faIcons from "./faicons";
import { Columns, ntimes } from "./Columns";

export const DynamicFontAwesomeIcon = ({ icon, className }) => {
  if (!icon) return null;
  return <i className={`${icon} ${className || ""}`}></i>;
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
  !textStyle || !textStyle.startsWith("h") ? (
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
  const { mode } = useContext(optionsCtx);

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
  return mode !== "show" ? (
    children
  ) : (
    <Fragment>
      <div className="input-group  input-group-sm w-100">
        {isFormula[nodekey] ? (
          <input
            type="text"
            className="form-control text-to-display"
            value={node[nodekey]}
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
          <small className="text-muted font-monospace">FORMULA</small>
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
  const options = useContext(optionsCtx);
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
  const options = useContext(optionsCtx);
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
      <td>
        <label>Text Style</label>
      </td>
      <td>
        <TextStyleSelect textStyle={textStyle} setProp={setProp} />
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
    },
    body: JSON.stringify(body),
  })
    .then(function (response) {
      if (response.status < 399) return response.text();
      else return "";
    })
    .then(function (html) {
      $(".preview-scratchpad").html(html);
      $(".preview-scratchpad").find("a").attr("href", "#");
      $(".preview-scratchpad")
        .find("[onclick], button, a, input, select")
        .attr("onclick", "return false");

      //.attr("disabled", true);
      $(".preview-scratchpad").find("textarea").attr("disabled", true);
      $(".preview-scratchpad .full-page-width").removeClass("full-page-width");
      if (isView) {
        $(".preview-scratchpad").find("input").attr("readonly", true);
      }
      const newHtml = $(".preview-scratchpad").html();
      setPreviews((prevState) => ({ ...prevState, [node_id]: newHtml }));
    });
};

/**
 * @function
 * @param {object} [args = {}]
 * @return {function}
 */
export const fetchFieldPreview = (args = {}) => (changes = {}) => {
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
export const fetchViewPreview = (args = {}) => (changes = {}) => {
  const { node_id, options, view, setPreviews, configuration } = {
    ...args,
    ...changes,
  };
  let viewname,
    body = configuration ? { ...configuration } : {};
  if (view.includes(":")) {
    const [reltype, rest] = view.split(":");
    const [vnm] = rest.split(".");
    viewname = vnm;
    body.reltype = reltype;
    body.path = rest;
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
const SelectUnits = ({ vert, autoable, ...props }) => (
  <select {...props}>
    <option>px</option>
    <option>%</option>
    <option>{vert ? "vh" : "vw"}</option>
    <option>em</option>
    <option>rem</option>
    {autoable && <option>auto</option>}
  </select>
);

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
export const reactifyStyles = (styles) => {
  const toCamel = (s) => {
    return s.replace(/([-][a-z])/gi, ($1) => {
      return $1.toUpperCase().replace("-", "");
    });
  };
  const reactified = {};
  Object.keys(styles).forEach((k) => {
    reactified[toCamel(k)] = styles[k];
  });
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
const ConfigForm = ({ fields, configuration, setProp, node, onChange }) => (
  <div>
    {fields.map((f, ix) => {
      if (f.showIf && configuration) {
        let noshow = false;
        Object.entries(f.showIf).forEach(([nm, value]) => {
          if (Array.isArray(value))
            noshow = noshow || value.includes(configuration[nm]);
          else noshow = noshow || value !== configuration[nm];
        });
        if (noshow) return null;
      }
      return (
        <div key={ix}>
          {!isCheckbox(f) ? <label>{f.label || f.name}</label> : null}
          <ConfigField
            field={f}
            configuration={configuration}
            setProp={setProp}
            onChange={onChange}
          />
          {f.sublabel ? (
            <i dangerouslySetInnerHTML={{ __html: f.sublabel }}></i>
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
  isStyle,
}) => {
  /**
   * @param {object} v
   * @returns {void}
   */
  const options = useContext(optionsCtx);

  const myOnChange = (v) => {
    setProp((prop) => {
      if (configuration) {
        if (!prop.configuration) prop.configuration = {};
        prop.configuration[field.name] = v;
      } else if (isStyle) {
        if (!prop.style) prop.style = {};
        prop.style[field.name] = v;
      } else prop[field.name] = v;
    });
    onChange && onChange(field.name, v);
  };
  const value = or_if_undef(
    configuration
      ? configuration[field.name]
      : isStyle
      ? props.style[field.name]
      : props[field.name],
    field.default
  );
  if (field.input_type === "fromtype") field.input_type = null;
  if (field.type && field.type.name === "String" && field.attributes.options) {
    field.input_type = "select";
    field.options = field.attributes.options;
    if (!field.required) field.options.unshift("");
  }
  const dispatch = {
    String() {
      if (field.attributes?.options) {
        const options =
          typeof field.attributes.options === "string"
            ? field.attributes.options.split(",").map((s) => s.trim())
            : field.attributes.options;
        return (
          <select
            className="form-control form-select"
            value={value || ""}
            onChange={(e) => e.target && myOnChange(e.target.value)}
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
            className="form-control"
            value={value || ""}
            onChange={(e) => e.target && myOnChange(e.target.value)}
          />
        );
    },
    Font: () => (
      <select
        className="form-control form-select"
        value={value || ""}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      >
        <option value={""}></option>
        {Object.entries(options.fonts || {}).map(([nm, ff], ix) => (
          <option key={ix} value={ff}>
            {nm}
          </option>
        ))}
      </select>
    ),
    Integer: () => (
      <input
        type="number"
        className="form-control"
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
        className="form-control"
        value={value || ""}
        step={0.01}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      />
    ),
    Color: () => <ColorInput value={value} onChange={(c) => myOnChange(c)} />,
    Bool: () => (
      <div className="form-check">
        <input
          type="checkbox"
          className="form-check-input"
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
        className="form-control"
        value={value}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      />
    ),
    code: () => (
      <textarea
        rows="6"
        type="text"
        className="form-control"
        value={value}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      />
    ),
    select: () => (
      <select
        className="form-control form-select"
        value={value || ""}
        onChange={(e) => e.target && myOnChange(e.target.value)}
      >
        {field.options.map((o, ix) => (
          <option key={ix}>{o}</option>
        ))}
      </select>
    ),
    btn_select: () => (
      <div className="btn-group w-100" role="group">
        {field.options.map((o, ix) => (
          <button
            key={ix}
            title={o.title || o.value}
            type="button"
            style={{ width: `${Math.floor(100 / field.options.length)}%` }}
            className={`btn btn-sm btn-${
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
      } else if (isStyle && value && typeof value === "string") {
        const matches = value.match(/^([0-9]+\.?[0-9]*)(.*)/);
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
              value={(isStyle ? styleVal : value) || ""}
              className="w-50 form-control-sm d-inline dimunit"
              disabled={field.autoable && styleDim === "auto"}
              onChange={(e) =>
                myOnChange(
                  isStyle
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
                : isStyle
                ? styleDim
                : props[field.name + "Unit"],
              "px"
            )}
            autoable={field.autoable}
            className={`w-${
              styleDim === "auto" ? 100 : 50
            } form-control-sm d-inline dimunit`}
            vert={true}
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
                } else prop[field.name + "Unit"] = target_value;
              });
            }}
          />
        </Fragment>
      );
    },
  };
  const f = dispatch[field.input_type || field.type.name || field.type];
  return f ? f() : null;
};

export /**
 * @param {object[]} fields
 * @category saltcorn-builder
 * @subcategory components / elements / utils
 * @namespace
 * @returns {table}
 */
const SettingsFromFields = (fields) => () => {
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

  return (
    <table className="w-100">
      <tbody>
        {fields.map((f, ix) => (
          <SettingsRow field={f} key={ix} node={node} setProp={setProp} />
        ))}
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
const SettingsRow = ({ field, node, setProp, onChange, isStyle }) => {
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
    />
  );
  return (
    <tr>
      {fullWidth ? (
        <td colSpan="2">
          {needLabel && <label>{field.label}</label>}
          {inner}
        </td>
      ) : (
        <Fragment>
          <td>
            <label>{field.label}</label>
          </td>
          <td>{inner}</td>
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
    console.log(
      "ErrorBoundary reporting: ",
      JSON.stringify(error),
      JSON.stringify(errorInfo)
    );

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
}) => {
  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
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
            <option value={addBtnClass("btn-link")}>Link</option>
          ) : null}
          <option value={addBtnClass("btn-primary")}>Primary button</option>
          <option value={addBtnClass("btn-secondary")}>Secondary button</option>
          <option value={addBtnClass("btn-success")}>Success button</option>
          <option value={addBtnClass("btn-danger")}>Danger button</option>
          <option value={addBtnClass("btn-outline-primary")}>
            Primary outline button
          </option>
          <option value={addBtnClass("btn-outline-secondary")}>
            Secondary outline button
          </option>
          <option value={addBtnClass("btn-custom-color")}>
            Button custom color
          </option>
          {!linkFirst ? (
            <option value={addBtnClass("btn-link")}>Link</option>
          ) : null}
        </select>
      </td>
    </tr>,
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
          <option value="btn-block">Block</option>
          <option value="btn-block btn-lg">Large block</option>
        </select>
      </td>
    </tr>,
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
          icons={faIcons}
        />
      </td>
    </tr>,
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
export const recursivelyCloneToElems = (query) => (nodeId, ix) => {
  const { data } = query.node(nodeId).get();
  const { type, props, nodes } = data;
  const children = (nodes || []).map(recursivelyCloneToElems(query));
  if (data.displayName === "Columns") {
    const cols = ntimes(data.props.ncols, (ix) =>
      recursivelyCloneToElems(query)(data.linkedNodes["Col" + ix])
    );
    return React.createElement(Columns, {
      ...props,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
      contents: cols,
    });
  }
  if (data.isCanvas)
    return React.createElement(
      Element,
      {
        ...props,
        canvas: true,
        is: type,
        ...(typeof ix !== "undefined" ? { key: ix } : {}),
      },
      children
    );
  return React.createElement(
    type,
    {
      ...props,
      ...(typeof ix !== "undefined" ? { key: ix } : {}),
    },
    children
  );
};

export const isBlock = (block, inline, textStyle) =>
  !textStyle || !textStyle.startsWith("h") ? block : !inline;
