const app = require('./service.js');
const metrics = require('./metrics.js');
const logger = require('./logger.js');

async function logAndExit(error) {
  console.error(error);
  try {
    await logger.exceptionLogger(error);
  } finally {
    process.exit(1);
  }
}

process.on('uncaughtException', logAndExit);
process.on('unhandledRejection', logAndExit);

metrics.sendMetricsPeriodically(10000);

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
