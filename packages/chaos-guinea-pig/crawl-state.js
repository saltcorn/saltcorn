class CrawlState {
  constructor(o) {
    this.cookie = o.cookie || "";
    this.stop_form_actions = o.stop_form_actions || [];
  }
  check_form_action(action) {
    return !this.stop_form_actions.some(sfa => action.includes(sfa));
  }
}

module.exports = CrawlState;
