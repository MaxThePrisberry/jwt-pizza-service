const logger = require('./src/logger.js');

jest.spyOn(logger, 'sendLogToGrafana').mockImplementation(() => Promise.resolve());

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5);
}
