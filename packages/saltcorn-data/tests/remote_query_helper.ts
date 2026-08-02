import * as State from "../db/state.js";

declare let global: any;

const baseURL = "http://localhost:3000";

// Node's fetch has no browser cookie jar, so the session cookie has to be
// tracked and attached by hand, and stashed on mobileConfig.cookie so it
// also covers view.ts's/file.ts's own internal fetch calls for remote
// queries and file uploads.
let sessionCookie: string | undefined;

const captureSessionCookie = (res: Response) => {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) sessionCookie = setCookie.split(";")[0];
};

const withCookie = (headers: Record<string, string> = {}) => ({
  ...(sessionCookie ? { Cookie: sessionCookie } : {}),
  ...headers,
});

const fetchCsrfToken = async (): Promise<string> => {
  const res = await fetch(`${baseURL}/auth/csrf-token`, {
    headers: withCookie(),
  });
  captureSessionCookie(res);
  const data = await res.json();
  return data.csrfToken;
};

export const prepareQueryEnviroment = async () => {
  // isNode() checks for the absence of a global `window`, which is how view
  // templates decide to render mobile-style markup (e.g. execLink onclick
  // instead of a plain href) - set it to simulate the mobile/webview context
  // these remote-query tests are meant to exercise.
  global.window = {};
  const csrfToken = await fetchCsrfToken();
  const loginRes = await fetch(`${baseURL}/auth/login-with/session`, {
    method: "POST",
    headers: withCookie({
      "Content-Type": "application/json",
      "CSRF-Token": csrfToken,
    }),
    body: JSON.stringify({ email: "admin@foo.com", password: "AhGGr6rhu45" }),
  });
  captureSessionCookie(loginRes);
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error("Test admin login failed");
  // req.login() regenerates the session, so the pre-login CSRF token is stale.
  const state = await State.getState();
  state!.mobileConfig = {
    hasSession: true,
    csrfToken: await fetchCsrfToken(),
    cookie: sessionCookie,
  } as any;
};

export const sendViewToServer = async (view: any) => {
  let copy = JSON.parse(JSON.stringify(view));
  copy.id = undefined;
  const state = await State.getState();
  await fetch(`${baseURL}/viewedit/test/inserter`, {
    method: "POST",
    headers: withCookie({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "CSRF-Token": state!.mobileConfig?.csrfToken || "",
    }),
    body: JSON.stringify(copy),
  });
};

export const deleteViewFromServer = async (id: number) => {
  const state = await State.getState();
  await fetch(`${baseURL}/viewedit/delete/${id}`, {
    method: "POST",
    headers: withCookie({
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "CSRF-Token": state!.mobileConfig?.csrfToken || "",
    }),
    body: JSON.stringify({}),
  });
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
          minRole: 100,
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
          minRole: 100,
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
          minRole: 100,
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
        minRole: 100,
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
        minRole: 100,
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
        minRole: 100,
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
