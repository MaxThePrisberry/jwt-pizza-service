const config = require('./config');

const secretKeys = ['password', 'token', 'jwt', 'apiKey', 'authorization'];

class Logger {
  httpLogger = (req, res, next) => {
    const json = res.json;
    res.json = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: req.body,
        resBody: resBody,
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.json = json;
      return res.json(resBody);
    };
    next();
  };

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    return this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Date.now() * 1000000).toString();
  }

  sanitize(logData) {
    return JSON.stringify(logData, (key, value) => (secretKeys.includes(key) ? '*****' : value));
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    return fetch(`${config.logging.endpointUrl}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
      signal: AbortSignal.timeout(10 * 1000),
    })
      .then((res) => {
        if (!res.ok) console.log(`Failed to send log to Grafana: ${res.status}`);
      })
      .catch((error) => {
        console.log('Error sending log to Grafana', error.message);
      });
  }
}
module.exports = new Logger();
