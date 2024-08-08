// utils.js
const { expect } = require('@playwright/test');
const Logger = require('./logger');

async function customAssert(description, assertion) {
  try {
    await assertion();
    Logger.info(`Assertion passed: ${description}`);
  } catch (error) {
    Logger.error(`Assertion failed: ${description} - ${error.message}`);
  }
}

module.exports = customAssert;
