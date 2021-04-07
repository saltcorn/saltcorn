const { Command, flags } = require("@oclif/command");
const wrkCB = require("wrk");

const wrk = (args) =>
  new Promise(function (resolve, reject) {
    wrkCB(args, function (err, out) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      out.latencyAvgMs = parseFloat(out.latencyAvg);
      out.latencyMaxMs = parseFloat(out.latencyMax);
      resolve(out);
    });
  });

const ensure_no_final_slash = (s) => (s.endsWith("/") ? s.slice(0, -1) : s);

class RunBenchmarkCommand extends Command {
  async run() {
    const {
      args: { baseurl },
      flags: { token },
    } = this.parse(RunBenchmarkCommand);
    const File = require("@saltcorn/data/models/file");
    const file = await File.findOne({ filename: "rick.png" });

    const getURL = (pth) =>
      `${ensure_no_final_slash(baseurl || "http://localhost:3000")}${pth}`;
    const bench = (url) =>
      wrk({
        threads: 2,
        connections: 50,
        duration: "10s",
        url: getURL(url),
      });
    const stored_file = await bench(`/files/serve/${file.id}`);
    const static_file = await bench("/saltcorn.css");
    const form_view = await bench("/view/NewThread");
    const simple_page = await bench("/page/simplepage");
    const complex_page = await bench("/page/homepage");

    console.log({stored_file, static_file, form_view, simple_page, complex_page});
    process.exit(0);
  }
}

RunBenchmarkCommand.args = [
  { name: "baseurl", required: false, description: "Base URL" },
];

RunBenchmarkCommand.description = `Run benchmark`;

RunBenchmarkCommand.flags = {
  token: flags.string({
    char: "t",
    description: "API Token for reporting results",
  }),
};
module.exports = RunBenchmarkCommand;
