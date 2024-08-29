import db from "../db/index";
import layoutMarkup from "@saltcorn/markup/layout";
const renderLayout = layoutMarkup;
import Table from "../models/table";
import TableConstraint from "../models/table_constraints";
import Form from "../models/form";
import Field from "../models/field";
import Crash from "../models/crash";
import Model from "../models/model";
import ModelInstance from "../models/model_instance";
import File from "../models/file";
import View from "../models/view";
import Page from "../models/page";
import PageGroup from "../models/page_group";
import PageGroupMember from "../models/page_group_member";
import layoutModel from "../models/layout";
const { getViews } = layoutModel;

const { getState } = require("../db/state");
import mocks from "./mocks";
const { rick_file, mockReqRes } = mocks;
import Library from "../models/library";
import { assertIsSet } from "./assertions";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";
import { existsSync } from "fs";
import { join, basename } from "path";

getState().registerPlugin("base", require("../base-plugin"));
beforeAll(async () => {
  await require("../db/reset_schema")();
  await require("../db/fixtures")();
});

afterAll(db.close);

describe("File", () => {
  it("should create", async () => {
    await rick_file();
    const cs = await File.find();
    const f_rick = cs.find((f) => f.filename === "rick.png");

    expect(f_rick?.mime_super).toBe("image");
    const f = await File.findOne({ filename: "rick.png" });
    assertIsSet(f);
    //assertIsSet(f.id);
    expect(f.mime_sub).toBe("png");
    expect(f.mimetype).toBe("image/png");
    expect(f.user_id).toBe(1);
    expect(f.min_role_read).toBe(100);

    await f.set_role(80);
    await f.set_user(2);
    expect(f.user_id).toBe(2);
    expect(f.min_role_read).toBe(80);

    const f2 = await File.findOne("rick.png");
    assertIsSet(f2);
    expect(f2.user_id).toBe(2);
    expect(f2.min_role_read).toBe(80);

    expect(await f2.get_contents("utf8")).toBe("nevergonnagiveyouup");
    expect(await f2.get_contents("base64")).toBe(
      "bmV2ZXJnb25uYWdpdmV5b3V1cA=="
    );
    expect((await f2.get_contents()).toString()).toBe("nevergonnagiveyouup");

    await f.delete();
  });

  it("should find in subfolders", async () => {
    const subfolder = "subfolder";
    const fileName = "fileName2.html";
    if (
      !existsSync(
        join(db.connectObj.file_store, db.getTenantSchema(), "subfolder")
      )
    )
      await File.new_folder(subfolder);
    if (
      !existsSync(
        join(
          db.connectObj.file_store,
          db.getTenantSchema(),
          subfolder,
          fileName
        )
      )
    ) {
      await File.from_contents(
        fileName,
        "text/html",
        "<html><head><title>Landing page 2</title></head><body><h1>Or land here</h1></body></html>",
        1,
        100,
        subfolder
      );
    }
    const htmlFiles = await File.find(
      {
        mime_super: "text",
        mime_sub: "html",
      },
      { recursive: true }
    );
    expect(
      htmlFiles.find((file: any) => file.filename === fileName)
    ).toBeDefined();
  });

  it("should resolve filename clash in root", async () => {
    const file1 = await File.from_contents(
      "clashing.html",
      "text/html",
      "hello",
      1,
      100
    );
    expect(file1.filename).toBe("clashing.html");
    expect(file1.path_to_serve).toBe("clashing.html");
    expect(basename(file1.location)).toBe("clashing.html");
    const file2 = await File.from_contents(
      "clashing.html",
      "text/html",
      "world",
      1,
      100
    );
    expect(file2.filename).toBe("clashing_1.html");
    expect(basename(file2.location)).toBe("clashing_1.html");

    await file1.delete();
    await file2.delete();
    const file3 = await File.from_contents(
      "clashing.html",
      "text/html",
      "hello",
      1,
      100
    );
    expect(file3.filename).toBe("clashing.html");
    expect(basename(file3.location)).toBe("clashing.html");
    await file3.delete();
  });
  it("should resolve filename clash in subfolder", async () => {
    const subfolder = "subfolder";
    if (
      !existsSync(
        join(db.connectObj.file_store, db.getTenantSchema(), "subfolder")
      )
    )
      await File.new_folder(subfolder);
    const file1 = await File.from_contents(
      "clashing.html",
      "text/html",
      "hello",
      1,
      100,
      "subfolder"
    );

    expect(file1.filename).toBe("clashing.html");
    expect(file1.path_to_serve).toBe("subfolder/clashing.html");

    expect(basename(file1.location)).toBe("clashing.html");
    const file2 = await File.from_contents(
      "clashing.html",
      "text/html",
      "world",
      1,
      100,
      "subfolder"
    );
    expect(file2.filename).toBe("clashing_1.html");
    expect(basename(file2.location)).toBe("clashing_1.html");

    await file1.delete();
    await file2.delete();
  });
  it("should lookup mime types", async () => {
    expect(File.nameToMimeType("foo.html")).toBe("text/html");
    expect(File.nameToMimeType("foo.jpeg")).toBe("image/jpeg");
    expect(File.nameToMimeType("foo.jpg")).toBe("image/jpeg");
    expect(File.nameToMimeType("dir/foo.jpg")).toBe("image/jpeg");
    expect(File.nameToMimeType("FOO.JPG")).toBe("image/jpeg");
    expect(File.nameToMimeType("FOO.JPEG")).toBe("image/jpeg");
    expect(File.nameToMimeType("foo.py")).toBe("text/x-python");
  });
  it("should get the absolute path", async () => {
    const file = await File.from_contents(
      "video_stream.webm",
      "video/webm",
      "hello",
      1,
      100
    );
    expect(file.absolutePath).toBe(
      join(db.connectObj.file_store, db.getTenantSchema(), "video_stream.webm")
    );
    await file.delete();
  });
});
