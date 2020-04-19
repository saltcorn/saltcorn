const superagent = require("superagent");
const axios  = require("axios");

class CrawlState {
  constructor() {
    this.external_resources = [];
  }

  async check_external_resource(url, type) {
    if (this.external_resources.includes(url)) return;
    //console.log("checking", type, url);
    const lres = await axios.head(url,  {
        validateStatus: function (status) {
          return status < 400; // Reject only if the status code is greater than or equal to 500
        }
      });
    //if (lres.status == 200) {
      this.external_resources.push(url);
    /*} else {
      throw new Error(`Got response ${lres.status} to ${type} request ${url}`);
    }*/
  }

  async check_link(link) {
    await this.check_external_resource(link.attribs.href, "link");
  }
  async check_script_src(link) {
    await this.check_external_resource(link.attribs.src, "script");
  }
}

module.exports = CrawlState;
