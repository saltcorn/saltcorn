const fs= require('fs')
const path = require("path");
const db = require("./db");

const dateFormat = require("dateformat");

const migrate = async () => {
    const dbmigrationRows = await db.select("_sc_migrations")
    const dbmigrations=dbmigrationRows.map(r=>r.migration)
    //https://stackoverflow.com/questions/5364928/node-js-require-all-files-in-a-folder
    const files=fs.readdirSync(path.join(__dirname,"migrations")).filter(file=>file.match(/\.js$/) !== null)
    for(const file of files) {
            const name = file.replace('.js', '');
            if(!dbmigrations.includes(name)){
                console.log("Running migration", name)
                const contents=require(path.join(__dirname,"migrations", name))
                if(contents.sql) {
                    await db.query(contents.sql)
                }
                await db.insert("_sc_migrations", {migration: name}, true)
            }
      }

}

const create_blank_migration = async () => {
    var time = dateFormat(new Date(), "yyyymmddHHMM");
    const fnm = path.join(__dirname,"migrations",`${time}.js`)
    fs.writeFileSync(fnm, `
const sql= "";

module.exports = { sql }
    `)
    console.log(fnm)
}

module.exports={migrate, create_blank_migration}