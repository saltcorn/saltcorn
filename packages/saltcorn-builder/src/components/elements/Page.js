import React, { Fragment, useContext, useEffect } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import previewCtx from "../preview_context";
import { fetchPagePreview, setAPropGen } from "./utils";

export const Page = ({ page }) => {
  const {
    selected,
    node_id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected, node_id: node.id }));
  const options = useContext(optionsCtx);
  const { previews, setPreviews } = useContext(previewCtx);
  const myPreview = previews[node_id];
  useEffect(() => {
    fetchPagePreview({
      options,
      page,
      setPreviews,
      node_id,
    })();
  }, [page]);

  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`${myPreview ? "" : "builder-embed-view"} ${
        selected ? "selected-node" : ""
      }`}
    >
      {myPreview ? (
        <div
          className="d-inline"
          dangerouslySetInnerHTML={{ __html: myPreview }}
        ></div>
      ) : (
        `Page: ${page}`
      )}
    </div>
  );
};

export const PageSettings = () => {
  const node = useNode((node) => ({
    page: node.data.props.page,
    name: node.data.props.name,
    node_id: node.id,
  }));
  const {
    actions: { setProp },
    name,
    page,
    node_id,
  } = node;
  const options = useContext(optionsCtx);
  const pages = options.pages;
  const setAProp = setAPropGen(setProp);
  return (
    <div>
      <Fragment>
        <div>
          <label>Page to embed</label>
          <select
            value={page}
            className="form-control form-select"
            onChange={setAProp("page")}
            onBlur={setAProp("page")}
          >
            {pages
              .filter((p) =>
                options.page_name ? p.name !== options.page_name : true
              )
              .map((p, ix) => (
                <option key={ix} value={p.name}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </Fragment>
      {page ? (
        <a
          className="d-block mt-2"
          target="_blank"
          href={`/pageedit/edit/${page}`}
        >
          Edit this page
        </a>
      ) : null}
    </div>
  );
};

Page.craft = {
  displayName: "Page",
  related: {
    settings: PageSettings,
  },
};
