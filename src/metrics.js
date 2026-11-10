const config = require('./config');

const requests = {};
let requestLatency = 0;

function requestTracker(req, res, next) {
  const start = Date.now();
  requests[req.method] = (requests[req.method] || 0) + 1;
  res.on('finish', () => {
    requestLatency += Date.now() - start;
  });
  next();
}

function sendMetricsPeriodically(period) {
  setInterval(() => {
    try {
      const metrics = [];
      Object.keys(requests).forEach((method) => {
        metrics.push(createMetric('requests', requests[method], '1', 'sum', 'asInt', { method }));
      });
      metrics.push(createMetric('request_latency', requestLatency, 'ms', 'sum', 'asInt', {}));

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

module.exports = { requestTracker, sendMetricsPeriodically };
