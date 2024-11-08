// logger.js
const fs = require('fs');

class Logger {
  static initialize() {
    fs.writeFileSync('test.log', ''); // Overwrite the log file by clearing its contents
  }

  static info(message) {
    console.log(`INFO: ${message}`);
    fs.appendFileSync('test.log', `INFO: ${message}\n`);
  }

  static error(message) {
    console.error(`ERROR: ${message}`);
    fs.appendFileSync('test.log', `ERROR: ${message}\n`);
  }
}

module.exports = Logger;
