/**
 * @category saltcorn-builder
 * @module components/Toolbox
 * @subcategory components
 */

import React, { useEffect, useContext, Fragment } from "react";
import useTranslation from "../hooks/useTranslation";
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
import { rand_ident } from "./elements/utils";

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
const TextElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon={<TextareaT className="mb-2" />}
      fontSize="22px"
      title={t("Text")}
      bold
      label={t("Text")}
    >
      <Text text="Hello world" block={false} textStyle={""} />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ColumnsElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      innerClass="mt-m1px"
      icon="fas fa-columns"
      title={t("Split into columns")}
      label={t("Columns")}
    >
      <Columns contents={[]} setting_col_n={1} />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const TabsElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon={<SegmentedNav className="mb-2 h4" />}
      title={t("Tabbed content")}
      label={t("Tabs")}
    >
      <Tabs contents={[]} />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const LineBreakElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      text="↵"
      fontSize="26px"
      title={t("Line break")}
      label={t("Break")}
    >
      <LineBreak />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const HTMLElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-code"
      title={t("HTML code")}
      label={t("Code")}
    >
      <HTMLCode text={""} />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const CardElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      title={t("Card")}
      icon="far fa-square"
      label={t("Card")}
    >
      <Element canvas is={Card} isFormula={{}} url=""></Element>
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ImageElem = ({ connectors, images }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-image"
      title={t("Image")}
      label={t("Image")}
    >
      <Image fileid={images.length > 0 ? images[0].id : 0} />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const LinkElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-link"
      title={t("Link")}
      label={t("Link")}
    >
      <Link />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ViewElem = ({ connectors, views, isPageEdit }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-eye"
      title={t("Embed a view")}
      label={t("View")}
      disable={!views || views.length < (!isPageEdit ? 2 : 1)}
    >
      <View
        name={"not_assigned"}
        state={"shared"}
        view={views?.length > 0 ? views[0].name : ""}
      />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const SearchElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-search"
      title={t("Search bar")}
      label={t("Search")}
    >
      <Element canvas is={SearchBar}></Element>
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ContainerElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon={<BoundingBox className="mb-2 h5" />}
      title={t("Container")}
      label={t("Contain")}
    >
      <Element canvas is={Container}></Element>
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const FieldElem = ({ connectors, fields, field_view_options }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-asterisk"
      title={t("Field")}
      label={t("Field")}
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
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const DropDownFilterElem = ({ connectors, fields }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="far fa-caret-square-down"
      title={t("Dropdown filter")}
      label={t("Select")}
    >
      <DropDownFilter
        name={fields[0].name}
        block={false}
        neutral_label={""}
        full_width={false}
      />
    </WrapElem>
  );
};

const DropMenuElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="far fa-caret-square-down"
      title={t("Dropdown menu")}
      label={t("DropMenu")}
    >
      <Element canvas is={DropMenu}></Element>
    </WrapElem>
  );
};

const PageElem = ({ connectors, pages }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fa-fw far fa-file"
      title={t("Embed a page")}
      label={t("Page")}
      disable={pages.length <= 1}
    >
      <Page page={pages.length > 0 ? pages[0].name : "page"} />
    </WrapElem>
  );
};

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ToggleFilterElem = ({ connectors, fields }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon="fas fa-toggle-on"
      title={t("Toggle filter")}
      label={t("Toggle")}
    >
      <ToggleFilter name={fields[0].name} value={""} label={""} block={false} />
    </WrapElem>
  );
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const JoinFieldElem = ({ connectors, options }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icon={<Diagram3Fill className="mb-2 h5" />}
      title={t("Join field")}
      label={t("Join")}
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
};
/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ViewLinkElem = ({ connectors, options }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      icons={["fas fa-eye", "fas fa-link"]}
      title={t("Link to a view")}
      label={t("ViewLink")}
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
};

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const ActionElem = ({ connectors, options }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      label={t("Action")}
      icon="fas fa-running"
      title={t("Action button")}
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
        spinner={true}
        action_label={""}
        isFormula={{}}
        rndid={rand_ident()}
        configuration={{}}
      />
    </WrapElem>
  );
};

/**
 * @param {object} props
 * @param {object} props.connectors
 * @returns {WrapElem}
 * @category saltcorn-builder
 * @subcategory components / Toolbox
 * @namespace
 */
const AggregationElem = ({ connectors, child_field_list, agg_field_opts }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      text="∑"
      title={t("Aggregation")}
      label={t("Aggreg8")}
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
};

const TableElem = ({ connectors }) => {
  const { t } = useTranslation();
  return (
    <WrapElem
      connectors={connectors}
      innerClass="mt-m1px"
      icon="fas fa-table"
      title={t("Table")}
      label={t("Table")}
    >
      <Table contents={[[], []]} rows={2} columns={2} />
    </WrapElem>
  );
};

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
    pages,
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
      <PageElem connectors={connectors} pages={pages} />,
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
      !disable_toolbox?.dropdown_menu && (
        <ContainerElem connectors={connectors} />
      ),
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
    pages,
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
      <PageElem connectors={connectors} pages={pages} />,
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
