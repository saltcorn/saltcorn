const db = require("../db");
const { getState } = require("../db/state");
getState().registerPlugin("base", require("../base-plugin"));
const {
  create_backup, 
  restore
} = require("../models/backup");
const reset = require("../db/reset_schema");
const fs = require("fs").promises;
const Table = require("../models/table");
const View = require("../models/view");
const User = require("../models/user");

afterAll(db.close);

describe("Backup and restore", () => {
    it("should create and restore backup", async () => {
        const fnm = await create_backup()
        const t1=await Table.findOne({name:"books"})
        const t1c=await t1.countRows()
        const v1 = await View.find()
        expect(!!t1).toBe(true)
        
        await reset()
        await User.create({ email: "admin@foo.com", password: "secret", role_id: 1 });
        const t2=await Table.findOne({name:"books"})
        expect(t2).toBe(null)
        
        await restore(fnm, (p)=>{})
        
        const t3=await Table.findOne({name:"books"})
        expect(!!t3).toBe(true)
        const t3c=await t3.countRows()
        expect(t1c).toBe(t3c)
        const v2 = await View.find()
        expect(v1.length).toBe(v2.length)

        await fs.unlink(fnm)
    })
})