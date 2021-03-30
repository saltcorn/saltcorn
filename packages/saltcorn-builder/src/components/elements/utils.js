import React, { Fragment, useContext, useState } from "react";
import optionsCtx from "../context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

export const blockProps = (is_block) =>
  is_block ? { style: { display: "block" } } : {};

export const BlockSetting = ({ block, setProp }) => (
  <div className="form-check">
    <input
      className="form-check-input"
      name="block"
      type="checkbox"
      checked={block}
      onChange={(e) => setProp((prop) => (prop.block = e.target.checked))}
    />
    <label className="form-check-label">Block display</label>
  </div>
);

export const OrFormula = ({ setProp, isFormula, node, nodekey, children }) => {
  const { mode } = useContext(optionsCtx);

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
            onChange={(e) =>
              setProp((prop) => (prop[nodekey] = e.target.value))
            }
          />
        ) : (
          children
        )}
        <div className="input-group-append">
          <button
            className={`btn activate-formula ${
              isFormula[nodekey] ? "btn-secondary" : "btn-outline-secondary"
            }`}
            title="Calculated formula"
            type="button"
            onClick={(e) =>
              setProp((prop) => (prop.isFormula[nodekey] = !isFormula[nodekey]))
            }
          >
            <i className="fas fa-calculator"></i>
          </button>
        </div>
      </div>
      {isFormula[nodekey] && (
        <div style={{ marginTop: "-5px" }}>
          <small className="text-muted text-monospace">FORMULA</small>
        </div>
      )}
    </Fragment>
  );
};
export const MinRoleSetting = ({ minRole, setProp }) => {
  const options = useContext(optionsCtx);
  return (
    <div>
      <label>Minimum Role</label>
      <select
        value={minRole}
        onChange={(e) => setProp((prop) => (prop.minRole = e.target.value))}
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
export const MinRoleSettingRow = ({ minRole, setProp }) => {
  const options = useContext(optionsCtx);
  return (
    <tr>
      <td>
        <label>Minimum Role</label>
      </td>
      <td>
        <select
          value={minRole}
          className="form-control"

          onChange={(e) => setProp((prop) => (prop.minRole = e.target.value))}
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
const TextStyleSelect = ({ textStyle, setProp }) => {
  return (
    <select
      value={textStyle}
      className="form-control"
      onChange={(e) => setProp((prop) => (prop.textStyle = e.target.value))}
    >
      <option value="">Normal</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
      <option value="font-weight-bold">Bold</option>
      <option value="font-italic">Italics</option>
      <option value="small">Small</option>
      <option value="text-muted">Muted</option>
      <option value="text-underline">Underline</option>
      <option value="text-monospace">Monospace</option>
    </select>
  );
};
export const TextStyleSetting = ({ textStyle, setProp }) => {
  return (
    <div>
      <label>Text Style</label>
      <TextStyleSelect textStyle={textStyle} setProp={setProp} />
    </div>
  );
};
export const TextStyleRow = ({ textStyle, setProp }) => {
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

export const Accordion = ({ titles, children }) => {
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
              } pl-1 text-white w-100 mt-1`}
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

export const SelectUnits = ({ vert, ...props }) => (
  <select {...props}>
    <option>px</option>
    <option>%</option>
    <option>{vert ? "vh" : "vw"}</option>
    <option>em</option>
    <option>rem</option>
  </select>
);

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
const isCheckbox = (f) =>
  f && f.type && (f.type === "Bool" || f.type.name === "Bool");
export const setInitialConfig = (setProp, fieldview, fields) => {
  (fields || []).forEach((f, ix) => {
    if (f.input_type === "select")
      setProp((prop) => {
        if (!prop.configuration[f.name])
          prop.configuration[f.name] = f.options[0] || "";
      });
  });
};
export const ConfigForm = ({ fields, configuration, setProp, node }) => (
  <Fragment>
    {fields.map((f, ix) => {
      if (f.showIf && node && node.configuration) {
        let noshow = false;
        Object.entries(f.showIf).forEach(([nm, value]) => {
          if (Array.isArray(value))
            noshow = noshow || value.includes(node.configuration[nm]);
          else noshow = noshow || value !== node.configuration[nm];
        });
        if (noshow) return null;
      }
      return (
        <Fragment key={ix}>
          {!isCheckbox(f) ? <label>{f.label || f.name}</label> : null}
          <ConfigField
            field={f}
            configuration={configuration}
            setProp={setProp}
          />
          {f.sublabel ? <i>{f.sublabel}</i> : null}
        </Fragment>
      );
    })}
    <br />
  </Fragment>
);
export const ConfigField = ({ field, configuration, setProp }) =>
  ({
    String: () => (
      <input
        type="text"
        className="form-control"
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
    Integer: () => (
      <input
        type="number"
        className="form-control"
        step={1}
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
    Float: () => (
      <input
        type="number"
        className="form-control"
        step={0.01}
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
    Color: () => (
      <input
        type="color"
        className="form-control"
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
    Bool: () => (
      <div className="form-check">
        <input
          type="checkbox"
          className="form-check-input"
          checked={configuration[field.name]}
          onChange={(e) =>
            setProp(
              (prop) => (prop.configuration[field.name] = e.target.checked)
            )
          }
        />
        <label className="form-check-label">{field.label}</label>
      </div>
    ),
    textarea: () => (
      <textarea
        rows="6"
        type="text"
        className="form-control"
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
    select: () => (
      <select
        className="form-control"
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      >
        {field.options.map((o, ix) => (
          <option key={ix}>{o}</option>
        ))}
      </select>
    ),
  }[field.input_type || field.type.name || field.type]());
