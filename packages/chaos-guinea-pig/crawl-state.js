const request = require("supertest");

class CrawlState {
  constructor(o) {
    this.cookie = o.cookie || "";
    this.stop_form_actions = o.stop_form_actions || [];
    this.steps_left = o.steps || 20;
    this.log = [];
    this.app = o.app;
  }
  req() {
    return request(this.app);
  }
  add_log(l) {
    this.log.push(l);
  }
  check_form_action(action) {
    return !this.stop_form_actions.some((sfa) => action.includes(sfa));
  }
  decr() {
    this.steps_left -= 1;
    return this;
  }
  get steps_remaining() {
    return this.steps_left > 0;
  }
}

module.exports = CrawlState;
