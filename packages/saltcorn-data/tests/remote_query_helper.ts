import db from "../db";
import { sign } from "jsonwebtoken";
import axios from "axios";
import User from "../models/user";
const State = require("../db/state");

declare let global: any;

export const prepareQueryEnviroment = async () => {
  const user = await User.findOne({ email: "admin@foo.com" });
  const token = process.env.JSON_WEB_TOKEN
    ? process.env.JSON_WEB_TOKEN
    : sign(
        {
          sub: "admin@foo.com",
          role_id: 1,
          iss: "saltcorn@saltcorn",
          aud: "saltcorn-mobile-app",
          iat: user?.last_mobile_login?.valueOf(),
        },
        db.connectObj.jwt_secret
      );
  global.window = {
    localStorage: {
      getItem: (item: string) => {
        if (item === "auth_jwt") return token;
        return undefined;
      },
    },
  };
  const state = await State.getState();
  state.mobileConfig = { jwt: token, localTableIds: [] };
};

export const sendViewToServer = async (view: any) => {
  let copy = JSON.parse(JSON.stringify(view));
  copy.id = undefined;
  const url = `http://localhost:3000/viewedit/test/inserter`;
  const token = global.window.localStorage.getItem("auth_jwt");
  await axios.post(url, copy, {
    headers: {
      Authorization: `jwt ${token}`,
      "X-Requested-With": "XMLHttpRequest",
      "X-Saltcorn-Client": "mobile-app",
    },
  });
};

export const deleteViewFromServer = async (id: number) => {
  const url = `http://localhost:3000/viewedit/delete/${id}`;
  const token = global.window.localStorage.getItem("auth_jwt");
  await axios.post(
    url,
    {},
    {
      headers: {
        Authorization: `jwt ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        "X-Saltcorn-Client": "mobile-app",
      },
    }
  );
};

export const renderEditInEditConfig = {
  innerEdit: {
    layout: {
      above: [
        {
          style: {},
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Date",
                  labelFor: "date",
                  isFormula: {},
                  textStyle: "",
                },
              ],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: "editDay",
                  textStyle: "",
                  field_name: "date",
                  configuration: {},
                },
              ],
            },
          ],
          breakpoints: ["", ""],
        },
        {
          type: "line_break",
        },
        {
          style: {},
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Normalised",
                  labelFor: "normalised",
                  isFormula: {},
                  textStyle: "",
                },
              ],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: "edit",
                  textStyle: "",
                  field_name: "normalised",
                  configuration: {},
                },
              ],
            },
          ],
          breakpoints: ["", ""],
        },
        {
          type: "line_break",
        },
        {
          style: {},
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Temperature",
                  labelFor: "temperature",
                  isFormula: {},
                  textStyle: "",
                },
              ],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: "edit",
                  textStyle: "",
                  field_name: "temperature",
                  configuration: {},
                },
              ],
            },
          ],
          breakpoints: ["", ""],
        },
      ],
    },
    columns: [
      {
        type: "Field",
        block: false,
        fieldview: "editDay",
        textStyle: "",
        field_name: "date",
        configuration: {},
      },
      {
        type: "Field",
        block: false,
        fieldview: "edit",
        textStyle: "",
        field_name: "normalised",
        configuration: {},
      },
      {
        type: "Field",
        block: false,
        fieldview: "edit",
        textStyle: "",
        field_name: "temperature",
        configuration: {},
      },
    ],
  },
  outerEdit: {
    layout: {
      above: [
        {
          style: {},
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Favourite book",
                  labelFor: "favbook",
                  isFormula: {},
                  textStyle: "",
                },
              ],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: "select",
                  textStyle: "",
                  field_name: "favbook",
                  configuration: {},
                },
              ],
            },
          ],
          breakpoints: ["", ""],
        },
        {
          type: "line_break",
        },
        {
          style: {
            "margin-bottom": "1.5rem",
          },
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Name",
                  labelFor: "name",
                  isFormula: {},
                  textStyle: "",
                },
              ],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: "edit",
                  textStyle: "",
                  field_name: "name",
                  configuration: {},
                },
              ],
            },
          ],
          breakpoints: ["", ""],
        },
        {
          style: {},
          widths: [2, 10],
          besides: [
            {
              above: [
                null,
                {
                  font: "",
                  type: "blank",
                  block: false,
                  style: {},
                  inline: false,
                  contents: "Parent",
                  labelFor: "parent",
                  isFormula: {},
                  textStyle: "",
                },
              ],
            },
            {
              above: [
                null,
                {
                  type: "field",
                  block: false,
                  fieldview: "select",
                  textStyle: "",
                  field_name: "parent",
                  configuration: {},
                },
              ],
            },
          ],
          breakpoints: ["", ""],
        },
        {
          type: "line_break",
        },
        {
          name: "2d9725",
          type: "view",
          view: "ChildList:innerReads.readings.patient_id",
          state: "shared",
          configuration: {},
        },
        {
          type: "action",
          block: false,
          rndid: "8b4200",
          minRole: 10,
          isFormula: {},
          action_icon: "",
          action_name: "Save",
          action_size: "",
          action_bgcol: "",
          action_label: "",
          action_style: "btn-primary",
          configuration: {},
          action_textcol: "",
          action_bordercol: "",
        },
        {
          type: "action",
          block: false,
          rndid: "9ae75c",
          confirm: false,
          minRole: 10,
          isFormula: {},
          action_icon: "",
          action_name: "Reset",
          action_label: "",
          configuration: {},
        },
        {
          type: "action",
          block: false,
          rndid: "621bba",
          confirm: true,
          minRole: 10,
          isFormula: {},
          action_icon: "",
          action_name: "Delete",
          action_size: "",
          action_bgcol: "",
          action_label: "",
          action_style: "btn-primary",
          configuration: {},
          action_textcol: "",
          action_bordercol: "",
        },
      ],
    },
    columns: [
      {
        type: "Field",
        block: false,
        fieldview: "select",
        textStyle: "",
        field_name: "favbook",
        configuration: {},
      },
      {
        type: "Field",
        block: false,
        fieldview: "edit",
        textStyle: "",
        field_name: "name",
        configuration: {},
      },
      {
        type: "Field",
        block: false,
        fieldview: "select",
        textStyle: "",
        field_name: "parent",
        configuration: {},
      },
      {
        type: "Action",
        rndid: "8b4200",
        minRole: 10,
        isFormula: {},
        action_icon: "",
        action_name: "Save",
        action_size: "",
        action_bgcol: "",
        action_label: "",
        action_style: "btn-primary",
        configuration: {},
        action_textcol: "",
        action_bordercol: "",
      },
      {
        type: "Action",
        rndid: "9ae75c",
        confirm: false,
        minRole: 10,
        isFormula: {},
        action_icon: "",
        action_name: "Reset",
        action_label: "",
        configuration: {},
      },
      {
        type: "Action",
        rndid: "621bba",
        confirm: true,
        minRole: 10,
        isFormula: {},
        action_icon: "",
        action_name: "Delete",
        action_size: "",
        action_bgcol: "",
        action_label: "",
        action_style: "btn-primary",
        configuration: {},
        action_textcol: "",
        action_bordercol: "",
      },
    ],
  },
};
