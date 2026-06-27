import Table from "../models/table";
import Field from "../models/field";
import View from "../models/view";
import db from "../db";
import mocks from "./mocks";
const { mockReqRes } = mocks;
const { getState } = require("../db/state");
import { afterAll, beforeAll, describe, it, expect } from "@saltcorn/db-common/test_expect";
import { assertIsSet } from "./assertions";
import {
  prepareQueryEnviroment,
  sendViewToServer,
  deleteViewFromServer,
  renderEditInEditConfig,
} from "./remote_query_helper";

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

describe("to_locale_string fieldview", () => {
  const getFloatFV = () => {
    const state = getState();
    return state.types["Float"].fieldviews.to_locale_string;
  };
  const getIntFV = () => {
    const state = getState();
    return state.types["Integer"].fieldviews.to_locale_string;
  };

  it("formats USD currency with 2 decimal places", () => {
    const fv = getFloatFV();
    expect(
      fv.run(1234567.8, null, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    ).toBe("$1,234,567.80");
  });

  it("shows negative as (amount) with accounting currencySign", () => {
    const fv = getFloatFV();
    expect(
      fv.run(-1234567.8, null, {
        style: "currency",
        currency: "USD",
        currencySign: "accounting",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    ).toBe("($1,234,567.80)");
  });

  it("shows positive unchanged with accounting currencySign", () => {
    const fv = getFloatFV();
    expect(
      fv.run(500, null, {
        style: "currency",
        currency: "USD",
        currencySign: "accounting",
        minimumFractionDigits: 2,
      })
    ).toBe("$500.00");
  });

  it("pads decimal places with minimumFractionDigits", () => {
    const fv = getFloatFV();
    expect(
      fv.run(1200, null, {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    ).toBe("1,200.00");
  });

  it("shows explicit + sign with signDisplay always", () => {
    const fv = getFloatFV();
    expect(
      fv.run(500, null, { style: "decimal", signDisplay: "always" })
    ).toBe("+500");
  });

  it("shows - sign on negative with signDisplay always", () => {
    const fv = getFloatFV();
    expect(
      fv.run(-300, null, { style: "decimal", signDisplay: "always" })
    ).toBe("-300");
  });

  it("returns empty string for non-numeric value", () => {
    const fv = getFloatFV();
    expect(fv.run("not-a-number", null, { style: "decimal" })).toBe("");
  });

  it("works for Integer type too", () => {
    const fv = getIntFV();
    expect(
      fv.run(-42, null, {
        style: "currency",
        currency: "EUR",
        currencySign: "accounting",
        minimumFractionDigits: 2,
      })
    ).toBe("(€42.00)");
  });

  it("formats percent style", () => {
    const fv = getFloatFV();
    expect(
      fv.run(0.1234, null, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    ).toBe("12.3%");
  });
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
      '<select class="form-control form-select  " data-fieldname="favbook" name="favbook" id="inputfavbook" autocomplete="off"><option value="">None</option><option value="1">Herman Melville</option><option value="2">Leo Tolstoy</option></select>'
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
      '<select class="form-control form-select  " data-fieldname="favbook" name="favbook" id="inputfavbook" autocomplete="off"><option value="">None</option><option value="2">Leo Tolstoy</option></select>'
    );
  });
});
