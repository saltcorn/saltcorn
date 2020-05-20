const db = require("../db");
const { getState } = require("../db/state");
const Field = require("./field");
const { contract, is } = require("contractis");

const apply = (f, x) => (typeof f === "function" ? f(x) : f);

const applyAsync = async (f, x) => {
  if (typeof f === "function") return await f(x);
  else return f;
};

class Workflow {
  constructor(o) {
    this.steps = o.steps || [];
    this.onDone = o.onDone || (c => c);
    this.action = o.action;
    contract.class(this);
  }
  async run(body) {
    if (!body || !body.stepName) {
      return this.runStep(body || {}, 0);
    }
    const { stepName, contextEnc, ...stepBody } = body;

    const context = JSON.parse(decodeURIComponent(contextEnc));
    const stepIx = this.steps.findIndex(step => step.name === stepName);
    if (stepIx === -1) {
      //error
    }
    const step = this.steps[stepIx];
    const form = await applyAsync(step.form, context);

    const valres = form.validate(stepBody);
    if (valres.errors) {
      form.hidden("stepName", "contextEnc");
      form.values = {
        stepName: step.name,
        contextEnc
      };
      if (this.action) form.action = this.action;
      return { renderForm: form };
    }
    const toCtx = step.contextField
      ? { [step.contextField]: valres.success }
      : valres.success;

    return this.runStep({ ...context, ...toCtx }, stepIx + 1);
  }
  async runStep(context, stepIx) {
    if (stepIx >= this.steps.length) {
      return this.onDone(context);
    }
    const step = this.steps[stepIx];
    if (step.onlyWhen) {
      const toRun = await applyAsync(step.onlyWhen, context);

      if (!toRun) return this.runStep(context, stepIx + 1);
    }
    if (step.form) {
      const form = await applyAsync(step.form, context);

      form.hidden("stepName", "contextEnc");
      form.values.stepName = step.name;
      form.values.contextEnc = encodeURIComponent(JSON.stringify(context));

      form.fields.forEach(fld => {
        const ctxValue = step.contextField
          ? (context[step.contextField] || {})[fld.name]
          : context[fld.name];
        if (
          typeof ctxValue !== "undefined" &&
          typeof form.values[fld.name] === "undefined"
        ) {
          if (fld.type && fld.type.read)
            form.values[fld.name] = fld.type.read(ctxValue);
          else form.values[fld.name] = ctxValue;
        }
      });
      if (this.action) form.action = this.action;

      return { renderForm: form };
    } else if (step.builder) {
      const builder = await applyAsync(step.builder, context);
      return { renderBuilder: builder };
    }
  }
}

Workflow.contract = {
  variables: {
    steps: is.array(is.obj({ name: is.str })),
    onDone: is.fun(is.obj(), is.obj()),
    action: is.maybe(is.str)
  },
  methods: {
    run: is.fun(is.obj(), is.obj({ renderForm: is.maybe(is.class("Form")) }))
  }
};

module.exports = Workflow;
