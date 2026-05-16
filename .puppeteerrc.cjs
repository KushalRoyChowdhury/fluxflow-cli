const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Pin the precise version of Chrome you need
  chrome: {
    version: '148.0.7778.97',
  },
  // Use the home directory for the browser cache to keep the project folder clean
  cacheDirectory: join(require('os').homedir(), '.cache', 'puppeteer'),
};
