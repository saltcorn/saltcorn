const request = require("supertest");

const toSucceed = res => {
    if (res.statusCode >=400) {
      console.log(res.text);
      throw new Error(`Expected status ${expCode}, received ${res.statusCode}`);
    }
  };
  
const run = async (app, options={}) => {
    const startAt = options.startAt || "/";
    await step(app, startAt);
}

const step=async (app, url)=> {
    console.log("Checking page", url)
    const res = await request(app)
      .get(url)
      .expect(toSucceed)
    return
}


module.exports= run;