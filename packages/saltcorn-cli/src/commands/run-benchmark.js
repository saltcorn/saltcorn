const { Command, flags } = require("@oclif/command");
const wrk = require("wrk");

class RunBenchmarkCommand extends Command {
  async run() {
    const that = this;
    const {
      args: { baseurl },
      flags: { token },
    } = this.parse(RunBenchmarkCommand);
    wrk(
      {
        threads: 1,
        connections: 50,
        duration: "10s",
        url: baseurl || "http://localhost:3000/",
      },
      function (err, out) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        out.latencyAvgMs = parseFloat(out.latencyAvg)
        out.latencyMaxMs = parseFloat(out.latencyMax)
        console.log(out);
        process.exit(0);
      }
    );
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
