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
      flags: { token, delay },
    } = this.parse(RunBenchmarkCommand);
    const File = require("@saltcorn/data/models/file");
    const file = await File.findOne({ filename: "rick.png" });
    if (!file) {
      console.error("File not found. Run 'saltcorn reset-schema' then 'saltcorn setup-benchmark'");
      process.exit(1);
    }
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

    const sleep_dur = (delay || 30) * 1000;

    const benches = {
      static_file: "/saltcorn.css",
      stored_file: `/files/serve/${file.id}`,
      form_view: "/view/NewThread",
      simple_page: "/page/simplepage",
      complex_page: "/page/homepage",
    };
    for (const [what, url] of Object.entries(benches)) {
      process.stdout.write(`${what}:\t`);
      const result = await bench(url);
      const reqs = `${Math.round(result.requestsPerSec)}`.padStart(7, " ");
      console.log(`${reqs} req/s`);
      if (token) {
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
      if (what !== "complex_page") await sleep(sleep_dur);
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
  delay: flags.integer({
    char: "d",
    description: "delay between runs (s)",
    default: 30,
  }),
};
module.exports = RunBenchmarkCommand;
