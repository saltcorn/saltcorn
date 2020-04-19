const superagent = require("superagent");

class CrawlState {
  constructor() {
    this.external_resources = [];
  }

  async check_external_resource(url, type) {
    if (this.external_resources.includes(url)) return;
    console.log("checking", type, url);
    const lres = await superagent.head(url);
    if (lres.status == 200) {
      this.external_resources.push(url);
    } else {
      throw new Error(`Got response ${lres.status} to ${type} request ${url}`);
    }
  }

  async check_link(link) {
    this.check_external_resource(link.attribs.href, "link");
  }
  async check_script_src(link) {
    this.check_external_resource(link.attribs.src, "script");
  }
}

module.exports = CrawlState;
