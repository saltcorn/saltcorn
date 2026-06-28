import db from "../db/index.js";
import layoutMarkup from "@saltcorn/markup/layout";
import { getState } from "../db/state.js";
import basePluginMod from "../base-plugin/index.js";
import resetSchemaMod from "../db/reset_schema.js";
import fixturesMod from "../db/fixtures.js";
const renderLayout = layoutMarkup;
import Table from "../models/table.js";
import TableConstraint from "../models/table_constraints.js";
import Form from "../models/form.js";
import Field from "../models/field.js";
import Crash from "../models/crash.js";
import Model from "../models/model.js";
import ModelInstance from "../models/model_instance.js";
import File from "../models/file.js";
import View from "../models/view.js";
import Page from "../models/page.js";
import PageGroup from "../models/page_group.js";
import PageGroupMember from "../models/page_group_member.js";
import * as layoutModel from "../models/layout.js";
const { getViews } = layoutModel;

import * as mocks from "./mocks.js";
const { rick_file, mockReqRes } = mocks;
import Library from "../models/library.js";
import { assertIsSet } from "./assertions.js";
import { afterAll, beforeAll, describe, it, expect } from "@saltcorn/db-common/test_expect";
import { existsSync } from "fs";
import { open } from "fs/promises";
import { join, basename } from "path";

getState()!.registerPlugin("base", basePluginMod);
beforeAll(async () => {
  await resetSchemaMod();
  await fixturesMod();
});

afterAll(db.close);

describe("File class", () => {
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
    expect(htmlFiles.every((file) => file.location.endsWith(".html"))).toBe(
      true
    );
  });

  it("should find in subfolders by extension", async () => {
    const subfolder = "subfolder";
    const fileName = "fileName3.html";
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
        ext: "html",
      },
      { recursive: true }
    );

    expect(
      htmlFiles.find((file: any) => file.filename === fileName)
    ).toBeDefined();
    expect(htmlFiles.every((file) => file.location.endsWith(".html"))).toBe(
      true
    );
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
  it("should normalise_in_base", async () => {
    const file = await File.from_contents(
      "video_stream.webm",
      "video/webm",
      "hello",
      1,
      100
    );
    const base = join(db.connectObj.file_store, db.getTenantSchema());
    expect(File.normalise_in_base(base, "video_stream.webm")).toBe(
      join(base, "video_stream.webm")
    );
    expect(File.normalise_in_base(base, "../video_stream.webm")).toBe(
      join(base, "video_stream.webm")
    );
    await file.delete();
    expect(File.normalise_in_base("/var/files/", "foo/bar")).toBe(
      "/var/files/foo/bar"
    );
    expect(File.normalise_in_base("/var/files/", "/foo/bar")).toBe(
      "/var/files/foo/bar"
    );

    expect(File.normalise_in_base("/var/files/", "../../etc/passwd")).toBe(
      "/var/files/etc/passwd"
    );
    expect(File.normalise_in_base("/var/files/", "path/../../etc/passwd")).toBe(
      "/var/files/etc/passwd"
    );
    expect(File.normalise_in_base("/var/files/", "//etc/passwd")).toBe(
      "/var/files/etc/passwd"
    );
    expect(File.normalise_in_base("/var/files/", "..\\../etc/passwd")).toBe(
      "/var/files/etc/passwd"
    );
    expect(File.normalise_in_base("/var/files/", "..\\/../etc/passwd")).toBe(
      "/var/files/etc/passwd"
    );
    expect(File.normalise_in_base("/var/files/", "/////../../etc/passwd")).toBe(
      "/var/files/etc/passwd"
    );
    expect(
      File.normalise_in_base("/var/files/", "..%255c/..%255c/etc/passwd")
    ).toBe("/var/files/..%255c/..%255c/etc/passwd");
    expect(File.normalise_in_base("/var/files/", "..%2F..%2F/etc/passwd")).toBe(
      "/var/files/..%2F..%2F/etc/passwd"
    );
    expect(
      File.normalise_in_base(
        "/var/files/",
        "\u002e\u002e\u2215\u002e\u002e\u2215/etc/passwd"
      )
    ).toBe("/var/files/..\u2215..\u2215/etc/passwd");
    let fh = await open("/tmp/myfile", "a");
    await fh.close();
    expect(existsSync("/var/lib/..%255c/..%255c/tmp/myfile")).toBe(false);
    expect(existsSync("/var/lib/..%2F..%2F/tmp/myfile")).toBe(false);
    expect(existsSync("/var/lib/..\u2215..\u2215/tmp/myfile")).toBe(false);
    expect(existsSync("/var/lib/../../tmp/myfile")).toBe(true);
  });
  it("should return all directories", async () => {
    await File.new_folder("subfolder/mysubsubfolder");

    const dirs = await File.allDirectories();
    expect(dirs.length).toBeGreaterThan(2);
    expect(dirs.length).toBeLessThan(20);
    expect(dirs[0].constructor.name).toBe("File");
    const paths = dirs.map((d) => d.path_to_serve);

    expect(paths).toContain("subfolder");
    expect(paths).toContain("subfolder/mysubsubfolder");
    expect(paths).toContain("");
    expect(paths.filter((p) => p === "").length).toBe(1);
    const filenames = dirs.map((d) => d.filename);
    expect(filenames).toContain("subfolder");
  });
});

describe("File sandbox subclass", () => {
  const tenantBase = () =>
    join(db.connectObj.file_store, db.getTenantSchema());
  let SandboxFile: typeof File;
  let sandboxDir: string;

  beforeAll(async () => {
    sandboxDir = join(tenantBase(), "sandbox");
    await File.new_folder("sandbox");
    // a file inside the sandbox directory
    await File.from_contents(
      "inside.txt",
      "text/plain",
      "secret-in",
      1,
      100,
      "sandbox"
    );
    // a file outside the sandbox directory (in the tenant root)
    await File.from_contents(
      "outside.txt",
      "text/plain",
      "secret-out",
      1,
      100,
      "/"
    );
    SandboxFile = File.subClass({ sandbox_dir: sandboxDir });
  });

  it("can read files inside the sandbox", async () => {
    const f = await SandboxFile.findOne("sandbox/inside.txt");
    assertIsSet(f);
    expect(await f.get_contents("utf8")).toBe("secret-in");
  });

  it("cannot find a file outside the sandbox", async () => {
    const f = await SandboxFile.findOne("outside.txt");
    expect(f).toBe(null);
  });

  it("cannot escape the sandbox with path traversal", async () => {
    const f = await SandboxFile.findOne("sandbox/../outside.txt");
    expect(f).toBe(null);
  });

  it("cannot read a file outside the sandbox via a hand-built instance", async () => {
    const f = new SandboxFile({
      filename: "outside.txt",
      location: join(tenantBase(), "outside.txt"),
      uploaded_at: new Date(),
      size_kb: 1,
      mime_super: "text",
      mime_sub: "plain",
      min_role_read: 100,
    });
    await expect(f.get_contents("utf8")).rejects.toThrow(/sandbox/);
    expect(existsSync(join(tenantBase(), "outside.txt"))).toBe(true);
  });

  it("cannot overwrite or delete a file outside the sandbox", async () => {
    const f = new SandboxFile({
      filename: "outside.txt",
      location: join(tenantBase(), "outside.txt"),
      uploaded_at: new Date(),
      size_kb: 1,
      mime_super: "text",
      mime_sub: "plain",
      min_role_read: 100,
    });
    await expect(f.overwrite_contents("hacked")).rejects.toThrow(/sandbox/);
    await f.delete(); // delete swallows the error
    // the outside file must still exist with original contents
    const orig = await File.findOne("outside.txt");
    assertIsSet(orig);
    expect(await orig.get_contents("utf8")).toBe("secret-out");
  });

  it("cannot write a new file outside the sandbox", async () => {
    await expect(
      SandboxFile.from_contents("evil.txt", "text/plain", "x", 1, 100, "/")
    ).rejects.toThrow(/sandbox/);
    expect(existsSync(join(tenantBase(), "evil.txt"))).toBe(false);
  });

  it("can write a new file inside the sandbox", async () => {
    const f = await SandboxFile.from_contents(
      "new.txt",
      "text/plain",
      "ok",
      1,
      100,
      "sandbox"
    );
    expect(await f.get_contents("utf8")).toBe("ok");
    expect(existsSync(join(sandboxDir, "new.txt"))).toBe(true);
  });

  it("leaves the base File class unrestricted", async () => {
    const f = await File.findOne("outside.txt");
    assertIsSet(f);
    expect(await f.get_contents("utf8")).toBe("secret-out");
  });
});
