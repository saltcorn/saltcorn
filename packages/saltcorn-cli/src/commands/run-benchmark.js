const { Command, flags } = require("@oclif/command");
const si = require("systeminformation");
const fetch = require("node-fetch");

const wrkCB = require("wrk");
const { sleep } = require("../common");
const packagejson = require("../../package.json");

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
    const cpu = await si.cpu();
    const os = await si.osInfo();
    const mem = await si.mem();
    const memory = mem.total / (1024 * 1024);

    const sleep_dur = 30000;

    const stored_file = await bench(`/files/serve/${file.id}`);
    await sleep(sleep_dur);
    const static_file = await bench("/saltcorn.css");
    await sleep(sleep_dur);
    const form_view = await bench("/view/NewThread");
    await sleep(sleep_dur);
    const simple_page = await bench("/page/simplepage");
    await sleep(sleep_dur);
    const complex_page = await bench("/page/homepage");

    const out = {
      stored_file,
      static_file,
      form_view,
      simple_page,
      complex_page,
    };
    console.log(out);
    if (token) {
      for (const [what, result] of Object.entries(out)) {
        await fetch("https://benchmark.saltcorn.com/api/benchrun", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: token,
            what,
            reqs_per_sec: result.requestsPerSec,
            avg_latency: result.latencyAvgMs,
            max_latency: result.latencyMaxMs,
            date: new Date(),
            version: packagejson.version,
            cores: cpu.cores,
            distro: os.distro,
            memory,
          }),
        });
      }
    }
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
