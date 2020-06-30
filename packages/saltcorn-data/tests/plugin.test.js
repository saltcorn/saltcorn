const Plugin = require("../models/plugin");
const db = require("../db/index.js");

const { getState } = require("../db/state");

getState().registerPlugin("base", require("../base-plugin"));

afterAll(db.close);

describe("plugin", () => {
  it("cruds", async () => {
    const ps = await Plugin.find()
    expect(ps.length).toBe(2)
    const p = await Plugin.findOne({name:"base"})
    expect(p.name).toBe("base")
    const oldv =p.version 
    p.version=9.9
    await p.upsert()
    p.version=oldv
    await p.upsert()
    const newp = new Plugin({
        name:"foo", location:"bar/rol", source: "github"
    })
    await newp.upsert()
    await newp.delete()
  })
})
