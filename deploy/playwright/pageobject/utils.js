// utils.js
const { expect } = require('@playwright/test');
const Logger = require('./logger');

async function customAssert(description, assertionCallback) {
  try {
    await assertionCallback();
    Logger.info(`Assertion passed: ${description}`);
  } catch (error) {
    Logger.error(`Assertion failed: ${description} - ${error.message}`);
    throw error; // This will fail the test
  }
}

module.exports = customAssert;
