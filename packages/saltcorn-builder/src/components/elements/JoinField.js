import React, { useContext, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  TextStyleRow,
  fetchFieldPreview,
} from "./utils";
import previewCtx from "../preview_context";

export const JoinField = ({ name, block, fieldview, textStyle }) => {
  const {
    selected,
    node_id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected, node_id: node.id }));
  const { previews, setPreviews } = useContext(previewCtx);
  const myPreview = previews[node_id];
  const options = useContext(optionsCtx);

  useEffect(() => {
    fetchFieldPreview({
      options,
      name,
      fieldview,
      configuration: {},
      setPreviews,
      node_id,
    })();
  }, []);
  return (
    <span
      className={`${textStyle} ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {myPreview ? (
        <div
          className="d-inline"
          dangerouslySetInnerHTML={{ __html: myPreview }}
        ></div>
      ) : (
        `[${name}]`
      )}
    </span>
  );
};

export const JoinFieldSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    textStyle,
    fieldview,
    node_id,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
    fieldview: node.data.props.fieldview,
    node_id: node.id,
  }));
  const options = useContext(optionsCtx);
  const { setPreviews } = useContext(previewCtx);

  const fvs = options.field_view_options[name];
  const refetchPreview = fetchFieldPreview({
    options,
    name,
    fieldview,
    configuration: {},
    setPreviews,
    node_id,
  });
  return (
    <Fragment>
      <i>
        <small>
          Previews shown in canvas are indicative based on random rows
        </small>
      </i>
      <table className="w-100">
        <tbody>
          <tr>
            <td>
              <label>Join field</label>
            </td>
            <td>
              <select
                value={name}
                className="form-control"
                onChange={(e) => {
                  setProp((prop) => (prop.name = e.target.value));
                  const newfvs = options.field_view_options[e.target.value];
                  if (newfvs && newfvs.length > 0) {
                    setProp((prop) => (prop.fieldview = newfvs[0]));
                    refetchPreview({
                      name: e.target.value,
                      fieldview: newfvs[0],
                    });
                  } else refetchPreview({ name: e.target.value });
                }}
              >
                {options.parent_field_list.map((f, ix) => (
                  <option key={ix} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          {fvs && (
            <tr>
              <td>
                <label>Field view</label>
              </td>

              <td>
                <select
                  value={fieldview}
                  className="form-control"
                  onChange={(e) => {
                    setProp((prop) => (prop.fieldview = e.target.value));
                    refetchPreview({ fieldview: e.target.value });
                  }}
                >
                  {(fvs || []).map((fvnm, ix) => (
                    <option key={ix} value={fvnm}>
                      {fvnm}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          )}
          <tr>
            <td></td>
            <td>
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
          <TextStyleRow textStyle={textStyle} setProp={setProp} />
        </tbody>
      </table>
    </Fragment>
  );
};

JoinField.craft = {
  displayName: "JoinField",
  related: {
    settings: JoinFieldSettings,
  },
};
