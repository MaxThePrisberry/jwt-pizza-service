const os = require('os');
const config = require('./config');

const requests = {};
let requestLatency = 0;
const authAttempts = { success: 0, failure: 0 };
const activeUsers = new Map();
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

function requestTracker(req, res, next) {
  const start = Date.now();
  requests[req.method] = (requests[req.method] || 0) + 1;
  if (req.user) {
    activeUsers.set(req.user.id, start);
  }
  res.on('finish', () => {
    requestLatency += Date.now() - start;
  });
  next();
}

function authTracker(req, res, next) {
  res.on('finish', () => {
    authAttempts[res.statusCode === 200 ? 'success' : 'failure']++;
  });
  next();
}

function getCpuUsagePercentage() {
  const usage = process.cpuUsage(lastCpuUsage);
  const now = Date.now();
  const cpuMs = (usage.user + usage.system) / 1000;
  const cpuUsage = (cpuMs / ((now - lastCpuTime) * os.availableParallelism())) * 100;
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = now;
  return cpuUsage;
}

function getMemoryUsagePercentage() {
  const memoryLimit = Math.min(process.constrainedMemory(), os.totalmem());
  return (process.memoryUsage.rss() / memoryLimit) * 100;
}

function sendMetricsPeriodically(period) {
  setInterval(() => {
    try {
      const metrics = [];
      Object.keys(requests).forEach((method) => {
        metrics.push(createMetric('requests', requests[method], '1', 'sum', 'asInt', { method }));
      });
      metrics.push(createMetric('request_latency', requestLatency, 'ms', 'sum', 'asInt', {}));
      Object.keys(authAttempts).forEach((status) => {
        metrics.push(createMetric('auth_attempts', authAttempts[status], '1', 'sum', 'asInt', { status }));
      });

      const cutoff = Date.now() - 5 * 60 * 1000;
      activeUsers.forEach((lastSeen, userId) => {
        if (lastSeen < cutoff) {
          activeUsers.delete(userId);
        }
      });
      metrics.push(createMetric('active_users', activeUsers.size, '{users}', 'gauge', 'asInt', {}));

      metrics.push(createMetric('cpu', getCpuUsagePercentage(), '%', 'gauge', 'asDouble', {}));
      metrics.push(createMetric('memory', getMemoryUsagePercentage(), '%', 'gauge', 'asDouble', {}));

      sendMetricToGrafana(metrics);
    } catch (error) {
      console.log('Error sending metrics', error);
    }
  }, period);
}

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { requestTracker, authTracker, sendMetricsPeriodically };
