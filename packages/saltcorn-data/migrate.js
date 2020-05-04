const fs= require('fs')
const path = require("path");

const dateFormat = require("dateformat");

const migrate = async () => {
    //https://stackoverflow.com/questions/5364928/node-js-require-all-files-in-a-folder


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