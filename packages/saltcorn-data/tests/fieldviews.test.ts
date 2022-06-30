import Table from "../models/table";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
import mocks from "./mocks";
const { mockReqRes } = mocks;
const { getState } = require("../db/state");
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { assertIsSet } from "./assertions";
import {
  prepareQueryEnviroment,
  sendViewToServer,
  deleteViewFromServer,
  renderEditInEditConfig,
} from "./remote_query_helper";
import { Type } from "@saltcorn/types/common_types";

let remoteQueries = false;

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
  if (process.env.REMOTE_QUERIES === "true") {
    getState().setConfig("base_url", "http://localhost:3000");
    remoteQueries = true;
    prepareQueryEnviroment();
  }
});

describe("select fieldview", () => {
  it("should render without where", async () => {
    const patients = Table.findOne({ name: "patients" });
    const fieldSpec: any = {
      name: "favbook",
      label: "Favbook",
      table: patients,
      type: "Key to books",
      block: false,
      fieldview: "select",
      textStyle: "",
      field_name: "favbook",
      configuration: {
        neutral_label: "None",
      },
      attributes: { summary_field: "author" },
    };
    const field = new Field(fieldSpec);
    await field.fill_fkey_options();
    const fieldview = getState().keyFieldviews[field.fieldview as string];
    const res = fieldview.run(
      "favbook",
      null,
      fieldSpec.configuration,
      "",
      false,
      field
    );
    expect(res).toBe(
      '<select class="form-control form-select  " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value="">None</option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select>'
    );
  });
  it("should render with where", async () => {
    const patients = Table.findOne({ name: "patients" });
    const configuration = {
      neutral_label: "None",
      where: `pages== 728`,
    };
    const fieldSpec: any = {
      name: "favbook",
      label: "Favbook",
      table: patients,
      type: "Key to books",
      block: false,
      fieldview: "select",
      textStyle: "",
      field_name: "favbook",
      configuration,
      attributes: { summary_field: "author", ...configuration },
    };
    const field = new Field(fieldSpec);
    await field.fill_fkey_options();
    const fieldview = getState().keyFieldviews[field.fieldview as string];
    const res = fieldview.run(
      "favbook",
      null,
      fieldSpec.configuration,
      "",
      false,
      field
    );
    expect(res).toBe(
      '<select class="form-control form-select  " data-fieldname="favbook" name="favbook" id="inputfavbook"><option value="">None</option><option value="2">Leo Tolstoy</option></select>'
    );
  });
});
