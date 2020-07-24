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
import { craftToSaltcorn, layoutToNodes } from "./storage";

const { Provider } = optionsCtx;

const headOr = (xs, def) => (xs && xs.length > 0 ? xs[0] : def);

export const ToolboxShow = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const {
    fields,
    field_view_options,
    child_field_list,
    agg_field_opts
  } = options;
  return (
    <Fragment>
      <h5>Drag to add</h5>
      <table className="mb-3 toolbox">
        <tbody>
          <tr>
            <td
              ref={ref =>
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
              ref={ref =>
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
              ref={ref =>
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
              ref={ref =>
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
              ref={ref =>
                connectors.create(
                  ref,
                  <ViewLink
                    name={options.link_view_opts[0].name}
                    block={false}
                    minRole={10}
                  />
                )
              }
            >
              Link
            </td>
            <td
              title="Action button"
              ref={ref =>
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
            <td ref={ref => connectors.create(ref, <LineBreak />)}>↵</td>
            <td
              title="Aggregation"
              ref={ref =>
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
      <h5>Drag to add</h5>
      <table className="mb-3 toolbox">
        <tbody>
          <tr>
            <td
              ref={ref =>
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
              ref={ref =>
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
              ref={ref =>
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
            <td ref={ref => connectors.create(ref, <LineBreak />)}>↵</td>
          </tr>
          <tr>
            <td
              title="Action button"
              ref={ref =>
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

const rand_ident = () => Math.floor(Math.random() * 16777215).toString(16);

export const ToolboxPage = () => {
  const { connectors, query } = useEditor();
  const options = useContext(optionsCtx);
  const { views, images } = options;
  return (
    <Fragment>
      <h5>Drag to add</h5>
      <table className="mb-3 toolbox">
        <tbody>
          <tr>
            <td
              ref={ref =>
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
              ref={ref =>
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
              title="Line break"
              ref={ref => connectors.create(ref, <LineBreak />)}
              style={{ fontSize: "26px" }}
            >
              ↵
            </td>
            <td
              title="HTML code"
              ref={ref => connectors.create(ref, <HTMLCode text={""} />)}
            >
              <i className="fas fa-lg fa-code"></i>
            </td>
          </tr>
          <tr>
            <td
              title="Card"
              ref={ref => connectors.create(ref, <Card contents={<Empty />} />)}
            >
              Card
            </td>
            <td
              title="Image"
              ref={ref =>
                connectors.create(
                  ref,
                  <Image fileid={images.length > 0 ? images[0].id : 0} />
                )
              }
            >
              <i className="fas fa-lg fa-image"></i>
            </td>
          </tr>
          <tr>
            <td title="Link" ref={ref => connectors.create(ref, <Link />)}>
              <i className="fas fa-lg fa-link"></i>
            </td>
            <td
              title="View"
              ref={ref =>
                connectors.create(
                  ref,
                  <View
                    name={rand_ident()}
                    state={"shared"}
                    view={views.length > 0 ? views[0].name : "view"}
                  />
                )
              }
            >
              <i className="fas fa-lg fa-eye"></i>
            </td>
          </tr>
          <tr>
            <td
              title="Search bar"
              ref={ref => connectors.create(ref, <SearchBar />)}
            >
              <i className="fas fa-lg fa-search"></i>
            </td>
            <td
              title="Container"
              ref={ref =>
                connectors.create(ref, <Container contents={<Empty />} />)
              }
            >
              <i className="fas fa-lg fa-box-open"></i>
            </td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  );
};
