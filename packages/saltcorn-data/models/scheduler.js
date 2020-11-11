const Trigger = require("./trigger");

const sleepUntil = (date, plusSeconds) => {
  const waitTill = new Date();
  waitTill.setTime(date.getTime() + 1000 * plusSeconds);
  const now = new Date();
  const ms = waitTill.getTime() - now.getTime();
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const runScheduler = async ({
  stop_when = () => false,
  tickSeconds = 60 * 5,
} = {}) => {
  let stopit;
  const run = async () => {
    stopit = await stop_when();
    if (stopit) return;
    const triggers = await Trigger.find({ when_trigger: "Often" });
    for (const trigger of triggers) {
      await trigger.runWithoutRow();
    }
  };

  let i = 0;
  const firstrun = new Date();
  await run();

  while (!stopit) {
    i += 1;
    await sleepUntil(firstrun, tickSeconds * i);
    await run();
  }
};

module.exports = runScheduler;
