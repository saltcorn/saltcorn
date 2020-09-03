import React, { useEffect, useContext, Fragment } from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { HTMLCode } from "./elements/HTMLCode";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { TwoSplit } from "./elements/TwoSplit";
import { Action } from "./elements/Action";
import { Empty } from "./elements/Empty";
import { Card } from "./elements/Card";
import { Container } from "./elements/Container";
import { Image } from "./elements/Image";
import { View } from "./elements/View";
import { SearchBar } from "./elements/SearchBar";
import { Link } from "./elements/Link";
import optionsCtx from "./context";

const headOr = (xs, def) => (xs && xs.length > 0 ? xs[0] : def);

const WrapElem = ({ children, connectors, icon, text, fontSize, title }) => (
  <div
    className="wrap-builder-elem d-flex align-items-center justify-content-center"
    title={title}
    ref={(ref) => connectors.create(ref, children)}
  >
    <div className="inner" style={fontSize ? { fontSize } : {}}>
      {text || <i className={`fa-lg ${icon}`}></i>}
    </div>
  </div>
);
const TextElem = ({ connectors }) => (
  <WrapElem connectors={connectors} text="Text">
    <Text text="Hello world" block={false} textStyle={""} />
  </WrapElem>
);
const TwoSplitElem = ({ connectors }) => (
  <WrapElem
    connectors={connectors}
    icon="fas fa-columns"
    title="Split into columns"
  >
    <TwoSplit contents={[<Empty />, <Empty />]} />
  </WrapElem>
);
const LineBreakElem = ({ connectors }) => (
  <WrapElem connectors={connectors} text="↵" fontSize="26px" title="Line break">
    <Text text="Hello world" block={false} textStyle={""} />
  </WrapElem>
);
const HTMLElem = ({ connectors }) => (
  <WrapElem connectors={connectors} icon="fas fa-code" title="HTML code">
    <HTMLCode text={""} />
  </WrapElem>
);
const CardElem = ({ connectors }) => (
  <WrapElem connectors={connectors} text="Card">
    <Card contents={<Empty />} />
  </WrapElem>
);
const ImageElem = ({ connectors, images }) => (
  <WrapElem connectors={connectors} icon="fas fa-image" title="Image">
    <Image fileid={images.length > 0 ? images[0].id : 0} />
  </WrapElem>
);
const LinkElem = ({ connectors }) => (
  <WrapElem connectors={connectors} icon="fas fa-link" title="Link">
    <Link />
  </WrapElem>
);
const ViewElem = ({ connectors, views }) => (
  <WrapElem connectors={connectors} icon="fas fa-eye" title="View">
    <View
      name={"not_assigned"}
      state={"shared"}
      view={views.length > 0 ? views[0].name : "view"}
    />
  </WrapElem>
);
const SearchElem = ({ connectors }) => (
  <WrapElem connectors={connectors} icon="fas fa-search" title="Search bar">
    <SearchBar />
  </WrapElem>
);
const ContainerElem = ({ connectors }) => (
  <WrapElem connectors={connectors} icon="fas fa-box-open" title="Container">
    <Container contents={<Empty />} />
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
  } = options;
  return (
    <Fragment>
      <table className="mb-3 toolbox">
        <tbody>
          <tr>
            <td
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Text text="Hello world" block={false} textStyle={""} />
                )
              }
            >
              Text
            </td>
            <td
              title="Split into columns"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <TwoSplit contents={[<Empty />, <Empty />]} />
                )
              }
            >
              <i className="fas fa-lg fa-columns"></i>
            </td>
          </tr>
          <tr>
            <td
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Field
                    name={fields[0].name}
                    block={false}
                    textStyle={""}
                    fieldview={
                      fields[0].is_fkey
                        ? ""
                        : field_view_options[fields[0].name][0]
                    }
                  />
                )
              }
            >
              Field
            </td>
            <td
              title="Join field"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <JoinField
                    name={options.parent_field_list[0]}
                    textStyle={""}
                    block={false}
                  />
                )
              }
            >
              Join
            </td>
          </tr>
          <tr>
            <td
              title="Link to a view"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <ViewLink
                    name={options.link_view_opts[0].name}
                    block={false}
                    minRole={10}
                    label={""}
                  />
                )
              }
            >
              View Link
            </td>
            <td
              title="Action button"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Action
                    name={options.actions[0]}
                    block={false}
                    minRole={10}
                  />
                )
              }
            >
              Action
            </td>
          </tr>
          <tr>
            <td ref={(ref) => connectors.create(ref, <LineBreak />)}>↵</td>
            <td
              title="Aggregation"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Aggregation
                    agg_relation={child_field_list[0]}
                    agg_field={headOr(agg_field_opts[child_field_list[0]], "")}
                    stat={"Count"}
                    textStyle={""}
                    block={false}
                  />
                )
              }
            >
              ∑
            </td>
          </tr>
          <tr>
            <td
              title="Embed view"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <View
                    name={"not_assigned"}
                    state={"shared"}
                    view={views.length > 0 ? views[0].name : "view"}
                  />
                )
              }
            >
              <i className="fas fa-lg fa-eye"></i>
            </td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  );
};

export const ToolboxEdit = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { fields, field_view_options } = options;
  return (
    <Fragment>
      <table className="mb-3 toolbox">
        <tbody>
          <tr>
            <td
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Text text="Hello world" block={false} textStyle={""} />
                )
              }
            >
              Text
            </td>
            <td
              title="Split into columns"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <TwoSplit contents={[<Empty />, <Empty />]} />
                )
              }
            >
              <i className="fas fa-lg fa-columns"></i>
            </td>
          </tr>
          <tr>
            <td
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Field
                    name={fields[0].name}
                    block={false}
                    textStyle={""}
                    fieldview={
                      fields[0].is_fkey
                        ? ""
                        : field_view_options[fields[0].name][0]
                    }
                  />
                )
              }
            >
              Field
            </td>
            <td ref={(ref) => connectors.create(ref, <LineBreak />)}>↵</td>
          </tr>
          <tr>
            <td
              title="Action button"
              ref={(ref) =>
                connectors.create(
                  ref,
                  <Action
                    name={options.actions[0]}
                    block={false}
                    minRole={10}
                  />
                )
              }
            >
              Action
            </td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  );
};
export const ToolboxPage = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { views, images } = options;
  return (
    <Fragment>
      <TextElem connectors={connectors} />
      <TwoSplitElem connectors={connectors} />
      <LineBreakElem connectors={connectors} />
      <HTMLElem connectors={connectors} />
      <CardElem connectors={connectors} />
      <ImageElem connectors={connectors} images={images} />
      <LinkElem connectors={connectors} />
      <ViewElem connectors={connectors} views={views} />
      <SearchElem connectors={connectors} />
      <ContainerElem connectors={connectors} />
    </Fragment>
  );
};
