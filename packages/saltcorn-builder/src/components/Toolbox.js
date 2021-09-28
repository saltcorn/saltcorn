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
import { ToggleFilter } from "./elements/ToggleFilter";
import { Empty } from "./elements/Empty";
import { Card } from "./elements/Card";
import { Tabs } from "./elements/Tabs";
import { Container } from "./elements/Container";
import { Image } from "./elements/Image";
import { View } from "./elements/View";
import { SearchBar } from "./elements/SearchBar";
import { Link } from "./elements/Link";
import optionsCtx from "./context";
import {
  BoundingBox,
  Diagram3Fill,
  SegmentedNav,
  TextareaT,
} from "react-bootstrap-icons";

const headOr = (xs, def) => (xs && xs.length > 0 ? xs[0] : def);

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
const ColumnsElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    innerClass="mt-m1px"
    icon="fas fa-columns"
    title="Split into columns"
    label="Columns"
  >
    <Columns contents={[]} />
  </WrapElem>
);
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
const ImageElem = ({ connectors, images }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-image"
    title="Image"
    label="Image"
    disable={images.length === 0}
  >
    <Image fileid={images.length > 0 ? images[0].id : 0} />
  </WrapElem>
);
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
const ViewElem = ({ connectors, views }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-eye"
    title="Embed a view"
    label="View"
    disable={views.length === 0}
  >
    <View
      name={"not_assigned"}
      state={"shared"}
      view={views.length > 0 ? views[0].name : "view"}
    />
  </WrapElem>
);
const SearchElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-search"
    title="Search bar"
    label="Search"
  >
    <SearchBar />
  </WrapElem>
);
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
const DropDownFilterElem = ({ connectors, fields }) => (
  <WrapElem
    connectors={connectors}
    icon="far fa-caret-square-down"
    title="Dropdown filter"
    label="Dropdown"
  >
    <DropDownFilter
      name={fields[0].name}
      block={false}
      neutral_label={""}
      full_width={false}
    />
  </WrapElem>
);
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
      textStyle={""}
      block={false}
    />
  </WrapElem>
);
const ViewLinkElem = ({ connectors, options }) => (
  <WrapElem
    connectors={connectors}
    icons={["fas fa-eye", "fas fa-link"]}
    title="Link to a view"
    label="ViewLink"
    disable={options.link_view_opts.length === 0}
  >
    <ViewLink
      name={
        options.link_view_opts.length > 0 ? options.link_view_opts[0].name : ""
      }
      block={false}
      minRole={10}
      label={""}
    />
  </WrapElem>
);

const ActionElem = ({ connectors, options }) => (
  <WrapElem
    connectors={connectors}
    label="Action"
    icon="fas fa-running"
    title="Action button"
  >
    <Action
      name={options.actions[0]}
      block={false}
      minRole={10}
      confirm={false}
      action_label={""}
      isFormula={{}}
      rndid={"not_assigned"}
      configuration={{}}
    />
  </WrapElem>
);
const AggregationElem = ({ connectors, child_field_list, agg_field_opts }) => (
  <WrapElem
    connectors={connectors}
    text="∑"
    title="Aggregation"
    label="Calc"
    bold
    fontSize="16px"
    disable={child_field_list.length === 0}
  >
    <Aggregation
      agg_relation={child_field_list[0]}
      agg_field={headOr(agg_field_opts[child_field_list[0]], "")}
      stat={"Count"}
      textStyle={""}
      aggwhere={""}
      block={false}
    />
  </WrapElem>
);

export const ToolboxShow = () => {
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
  return (
    <Fragment>
      <div className="toolbar-row">
        <TextElem connectors={connectors} />
        <ColumnsElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <FieldElem
          connectors={connectors}
          fields={fields}
          field_view_options={field_view_options}
        />
        <LineBreakElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <JoinFieldElem connectors={connectors} options={options} />
        <ViewLinkElem connectors={connectors} options={options} />
      </div>
      <div className="toolbar-row">
        <ActionElem connectors={connectors} options={options} />
        <LinkElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <AggregationElem
          connectors={connectors}
          child_field_list={child_field_list}
          agg_field_opts={agg_field_opts}
        />
        <ViewElem connectors={connectors} views={views} />
      </div>
      <div className="toolbar-row">
        <ContainerElem connectors={connectors} />
        <CardElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <TabsElem connectors={connectors} />
        <ImageElem connectors={connectors} images={images} />
      </div>
      <div className="toolbar-row">
        <HTMLElem connectors={connectors} />
      </div>
    </Fragment>
  );
};

export const ToolboxFilter = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { fields, views } = options;
  return (
    <Fragment>
      <div className="toolbar-row">
        <TextElem connectors={connectors} />
        <ColumnsElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <LineBreakElem connectors={connectors} />
        <DropDownFilterElem connectors={connectors} fields={fields} />
      </div>
      <div className="toolbar-row">
        <ToggleFilterElem connectors={connectors} fields={fields} />
        <SearchElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <ActionElem connectors={connectors} options={options} />
        <ContainerElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <CardElem connectors={connectors} />
        <TabsElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <ViewElem connectors={connectors} views={views} />
        <HTMLElem connectors={connectors} />
      </div>
    </Fragment>
  );
};

export const ToolboxEdit = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { fields, field_view_options, images, views } = options;
  return (
    <Fragment>
      <div className="toolbar-row">
        <TextElem connectors={connectors} />
        <ColumnsElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <FieldElem
          connectors={connectors}
          fields={fields}
          field_view_options={field_view_options}
        />
        <LineBreakElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <ActionElem connectors={connectors} options={options} />
        <ContainerElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <CardElem connectors={connectors} />
        <TabsElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <LinkElem connectors={connectors} />
        <ImageElem connectors={connectors} images={images} />
      </div>
      <div className="toolbar-row">
        <HTMLElem connectors={connectors} />
        <ViewElem connectors={connectors} views={views} />
      </div>
    </Fragment>
  );
};

export const ToolboxPage = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { views, images } = options;
  return (
    <Fragment>
      <div className="toolbar-row">
        <TextElem connectors={connectors} />
        <ColumnsElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <LineBreakElem connectors={connectors} />
        <HTMLElem connectors={connectors} />
      </div>
      <div className="toolbar-row">
        <CardElem connectors={connectors} />
        <ImageElem connectors={connectors} images={images} />{" "}
      </div>
      <div className="toolbar-row">
        <LinkElem connectors={connectors} />
        <ViewElem connectors={connectors} views={views} />
      </div>
      <div className="toolbar-row">
        <SearchElem connectors={connectors} />
        <ActionElem connectors={connectors} options={options} />
      </div>
      <div className="toolbar-row">
        <ContainerElem connectors={connectors} />
        <TabsElem connectors={connectors} />
      </div>
    </Fragment>
  );
};
