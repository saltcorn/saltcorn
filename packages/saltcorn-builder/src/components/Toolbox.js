/**
 * @category saltcorn-builder
 * @module components/Toolbox
 * @subcategory components
 */

import React, { useEffect, useContext, Fragment } from "react";
import { Element, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { HTMLCode } from "./elements/HTMLCode";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { Columns } from "./elements/Columns";
import { Action } from "./elements/Action";
import { DropDownFilter } from "./elements/DropDownFilter";
import { DropMenu } from "./elements/DropMenu";
import { ToggleFilter } from "./elements/ToggleFilter";
import { Empty } from "./elements/Empty";
import { Card } from "./elements/Card";
import { Tabs } from "./elements/Tabs";
import { Table } from "./elements/Table";
import { Container } from "./elements/Container";
import { Image } from "./elements/Image";
import { View } from "./elements/View";
import { SearchBar } from "./elements/SearchBar";
import { Link } from "./elements/Link";
import { Page } from "./elements/Page";
import optionsCtx from "./context";
import {
  BoundingBox,
  Diagram3Fill,
  SegmentedNav,
  TextareaT,
} from "react-bootstrap-icons";
import { chunk } from "lodash";

/**
 *
 * @param {object[]} xs
 * @param {object} def
 * @returns {object}
 */
const headOr = (xs, def) => (xs && xs.length > 0 ? xs[0] : def);

export /**
 * @param {object} props
 * @param {object} props.children
 * @param {object} props.connectors
 * @param {string|object} props.icon
 * @param {object[]} props.icons
 * @param {string} props.text
 * @param {string|number} [props.fontSize]
 * @param {string} props.title
 * @param {string} props.innerClass
 * @param {boolean} props.bold
 * @param {string} props.label
 * @param {boolean} props.disable
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const WrapElem = ({
  children,
  connectors,
  icon,
  icons,
  text,
  fontSize,
  title,
  innerClass,
  bold,
  label,
  disable,
}) => (
  <div
    className={`${
      disable ? "text-muted" : ""
    }  d-inline-flex wrap-builder-elem align-items-center justify-content-center`}
    title={title}
    ref={disable ? undefined : (ref) => connectors.create(ref, children)}
  >
    <div
      className={`inner ${innerClass || ""}`}
      style={fontSize ? { fontSize } : {}}
    >
      {(text && (bold ? <strong>{text}</strong> : text)) ||
        (icons &&
          icons.map((ic, ix) => <i key={ix} className={`${ic}`}></i>)) ||
        (typeof icon === "string" ? <i className={`fa-lg ${icon}`}></i> : icon)}
    </div>
    <label>{label}</label>
  </div>
);

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const TextElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon={<TextareaT className="mb-2" />}
    fontSize="22px"
    title="Text"
    bold
    label="Text"
  >
    <Text text="Hello world" block={false} textStyle={""} />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ColumnsElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    innerClass="mt-m1px"
    icon="fas fa-columns"
    title="Split into columns"
    label="Columns"
  >
    <Columns contents={[]} setting_col_n={1} />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const TabsElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon={<SegmentedNav className="mb-2 h4" />}
    title="Tabbed content"
    label="Tabs"
  >
    <Tabs contents={[]} />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const LineBreakElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    text="↵"
    fontSize="26px"
    title="Line break"
    label="Break"
  >
    <LineBreak />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const HTMLElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-code"
    title="HTML code"
    label="Code"
  >
    <HTMLCode text={""} />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const CardElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    title="Card"
    icon="far fa-square"
    label="Card"
  >
    <Element canvas is={Card} isFormula={{}} url=""></Element>
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ImageElem = ({ connectors, images }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-image"
    title="Image"
    label="Image"
  >
    <Image fileid={images.length > 0 ? images[0].id : 0} />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const LinkElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-link"
    title="Link"
    label="Link"
  >
    <Link />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ViewElem = ({ connectors, views, isPageEdit }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-eye"
    title="Embed a view"
    label="View"
    disable={!views || views.length < (!isPageEdit ? 2 : 1)}
  >
    <View
      name={"not_assigned"}
      state={"shared"}
      view={views?.length > 0 ? views[0].name : ""}
    />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const SearchElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-search"
    title="Search bar"
    label="Search"
  >
    <Element canvas is={SearchBar}></Element>
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ContainerElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon={<BoundingBox className="mb-2 h5" />}
    title="Container"
    label="Contain"
  >
    <Element canvas is={Container}></Element>
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const FieldElem = ({ connectors, fields, field_view_options }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-asterisk"
    title="Field"
    label="Field"
  >
    <Field
      name={fields[0].name}
      block={false}
      textStyle={""}
      configuration={{}}
      fieldview={fields[0].is_fkey ? "" : field_view_options[fields[0].name][0]}
    />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const DropDownFilterElem = ({ connectors, fields }) => (
  <WrapElem
    connectors={connectors}
    icon="far fa-caret-square-down"
    title="Dropdown filter"
    label="Select"
  >
    <DropDownFilter
      name={fields[0].name}
      block={false}
      neutral_label={""}
      full_width={false}
    />
  </WrapElem>
);

const DropMenuElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon="far fa-caret-square-down"
    title="Dropdown menu"
    label="DropMenu"
  >
    <Element canvas is={DropMenu}></Element>
  </WrapElem>
);

const PageElem = ({ connectors, pages }) => (
  <WrapElem
    connectors={connectors}
    icon="fa-fw far fa-file"
    title="Embed a page"
    label="Page"
    disable={pages.length <= 1}
  >
    <Page page={pages.length > 0 ? pages[0].name : "page"} />
  </WrapElem>
);

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToggleFilterElem = ({ connectors, fields }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-toggle-on"
    title="Toggle filter"
    label="Toggle"
  >
    <ToggleFilter name={fields[0].name} value={""} label={""} block={false} />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const JoinFieldElem = ({ connectors, options }) => (
  <WrapElem
    connectors={connectors}
    icon={<Diagram3Fill className="mb-2 h5" />}
    title="Join field"
    label="Join"
    disable={options.parent_field_list.length === 0}
  >
    <JoinField
      name={options.parent_field_list[0]}
      configuration={{}}
      textStyle={""}
      block={false}
    />
  </WrapElem>
);
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ViewLinkElem = ({ connectors, options }) => (
  <WrapElem
    connectors={connectors}
    icons={["fas fa-eye", "fas fa-link"]}
    title="Link to a view"
    label="ViewLink"
    disable={!options.views || options.views.length < 2}
  >
    <ViewLink
      name={options.views?.length > 0 ? options.views[0].name : ""}
      block={false}
      minRole={100}
      label={""}
    />
  </WrapElem>
);

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ActionElem = ({ connectors, options }) => (
  <WrapElem
    connectors={connectors}
    label="Action"
    icon="fas fa-running"
    title="Action button"
  >
    <Action
      name={
        options.actions[0].optgroup
          ? options.actions[0].options[0]
          : options.actions[0]
      }
      action_row_variable={""}
      block={false}
      minRole={100}
      confirm={false}
      action_label={""}
      isFormula={{}}
      rndid={"not_assigned"}
      configuration={{}}
    />
  </WrapElem>
);

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const AggregationElem = ({ connectors, child_field_list, agg_field_opts }) => (
  <WrapElem
    connectors={connectors}
    text="∑"
    title="Aggregation"
    label="Aggreg8"
    bold
    fontSize="16px"
    disable={child_field_list.length === 0}
  >
    <Aggregation
      agg_relation={child_field_list[0]}
      agg_field={headOr(agg_field_opts[child_field_list[0]], "")?.name}
      stat={"Count"}
      textStyle={""}
      aggwhere={""}
      block={false}
    />
  </WrapElem>
);

const TableElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    innerClass="mt-m1px"
    icon="fas fa-table"
    title="Table"
    label="Table"
  >
    <Table contents={[[], []]} rows={2} columns={2} />
  </WrapElem>
);

const chunkToolBox = (elems, expanded) => {
  const chunks = chunk(elems, expanded ? 3 : 2);
  return chunks.map((es, ix) => (
    <div className="toolbar-row" key={ix}>
      {es.map((e, j) => (
        <Fragment key={j}>{e}</Fragment>
      ))}
    </div>
  ));
};

export /**
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToolboxShow = ({ expanded }) => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const {
    fields,
    field_view_options,
    child_field_list,
    agg_field_opts,
    views,
    images,
  } = options;
  return chunkToolBox(
    [
      <TextElem connectors={connectors} />,
      <ColumnsElem connectors={connectors} />,
      <FieldElem
        connectors={connectors}
        fields={fields}
        field_view_options={field_view_options}
      />,
      <LineBreakElem connectors={connectors} />,
      <JoinFieldElem connectors={connectors} options={options} />,
      <ViewLinkElem connectors={connectors} options={options} />,
      <ActionElem connectors={connectors} options={options} />,
      <LinkElem connectors={connectors} />,
      <AggregationElem
        connectors={connectors}
        child_field_list={child_field_list}
        agg_field_opts={agg_field_opts}
      />,
      <ViewElem connectors={connectors} views={views} />,
      <ContainerElem connectors={connectors} />,
      <CardElem connectors={connectors} />,
      <TabsElem connectors={connectors} />,
      <ImageElem connectors={connectors} images={images} />,
      <HTMLElem connectors={connectors} />,
      <DropMenuElem connectors={connectors} />,
      <TableElem connectors={connectors} />,
    ],
    expanded
  );
};
export /**
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToolboxList = ({ expanded }) => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const {
    fields,
    field_view_options,
    child_field_list,
    agg_field_opts,
    views,
    images,
    disable_toolbox,
  } = options;
  return chunkToolBox(
    [
      <TextElem connectors={connectors} />,
      <FieldElem
        connectors={connectors}
        fields={fields}
        field_view_options={field_view_options}
      />,
      <JoinFieldElem connectors={connectors} options={options} />,
      !disable_toolbox?.view_link && (
        <ViewLinkElem connectors={connectors} options={options} />
      ),
      !disable_toolbox?.action && (
        <ActionElem connectors={connectors} options={options} />
      ),
      !disable_toolbox?.link && <LinkElem connectors={connectors} />,
      !disable_toolbox?.aggregation && (
        <AggregationElem
          connectors={connectors}
          child_field_list={child_field_list}
          agg_field_opts={agg_field_opts}
        />
      ),
      !disable_toolbox?.view && (
        <ViewElem connectors={connectors} views={views} />
      ),
      // <ContainerElem connectors={connectors} />,
      // <CardElem connectors={connectors} />,
      //  <TabsElem connectors={connectors} />,
      <HTMLElem connectors={connectors} />,
      !disable_toolbox?.dropdown_menu && (
        <DropMenuElem connectors={connectors} />
      ),
      //  <TableElem connectors={connectors} />,
      options.allowMultipleElementsPerColumn &&
        !disable_toolbox?.line_break && (
          <LineBreakElem connectors={connectors} />
        ),
    ].filter(Boolean),
    expanded
  );
};

export /**
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToolboxFilter = ({ expanded }) => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const {
    fields,
    views,
    field_view_options,
    child_field_list,
    agg_field_opts,
  } = options;
  return chunkToolBox(
    [
      <TextElem connectors={connectors} />,
      <ColumnsElem connectors={connectors} />,
      <FieldElem
        connectors={connectors}
        fields={fields}
        field_view_options={field_view_options}
      />,
      <LineBreakElem connectors={connectors} />,
      <DropDownFilterElem connectors={connectors} fields={fields} />,
      <ToggleFilterElem connectors={connectors} fields={fields} />,
      <SearchElem connectors={connectors} />,
      <ActionElem connectors={connectors} options={options} />,
      <AggregationElem
        connectors={connectors}
        child_field_list={child_field_list}
        agg_field_opts={agg_field_opts}
      />,
      <ContainerElem connectors={connectors} />,
      <CardElem connectors={connectors} />,
      <TabsElem connectors={connectors} />,
      <ViewElem connectors={connectors} views={views} />,
      <HTMLElem connectors={connectors} />,
      <LinkElem connectors={connectors} />,
      <TableElem connectors={connectors} />,
      <DropMenuElem connectors={connectors} />,
    ],
    expanded
  );
};

export /**
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToolboxEdit = ({ expanded }) => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { fields, field_view_options, images, views } = options;
  return chunkToolBox(
    [
      <TextElem connectors={connectors} />,
      <ColumnsElem connectors={connectors} />,
      <FieldElem
        connectors={connectors}
        fields={fields}
        field_view_options={field_view_options}
      />,
      <LineBreakElem connectors={connectors} />,
      <ActionElem connectors={connectors} options={options} />,
      <ContainerElem connectors={connectors} />,
      <CardElem connectors={connectors} />,
      <TabsElem connectors={connectors} />,
      <LinkElem connectors={connectors} />,
      <ImageElem connectors={connectors} images={images} />,
      <HTMLElem connectors={connectors} />,
      <ViewElem connectors={connectors} views={views} />,
      <JoinFieldElem connectors={connectors} options={options} />,
      <DropMenuElem connectors={connectors} />,
      <TableElem connectors={connectors} />,
      <ViewLinkElem connectors={connectors} options={options} />,
    ],
    expanded
  );
};

export /**
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToolboxPage = ({ expanded }) => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { views, pages, images } = options;
  return chunkToolBox(
    [
      <TextElem connectors={connectors} />,
      <ColumnsElem connectors={connectors} />,
      <LineBreakElem connectors={connectors} />,
      <HTMLElem connectors={connectors} />,
      <CardElem connectors={connectors} />,
      <ImageElem connectors={connectors} images={images} />,
      <LinkElem connectors={connectors} />,
      <ViewElem connectors={connectors} views={views} isPageEdit={true} />,
      <SearchElem connectors={connectors} />,
      <ActionElem connectors={connectors} options={options} />,
      <ContainerElem connectors={connectors} />,
      <TabsElem connectors={connectors} />,
      <DropMenuElem connectors={connectors} />,
      <PageElem connectors={connectors} pages={pages} />,
      <TableElem connectors={connectors} />,
    ],
    expanded
  );
};
