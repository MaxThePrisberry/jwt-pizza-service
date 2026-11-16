const request = require('supertest');
const app = require('./service');
const logger = require('./logger.js');
const { DB } = require('./database/database.js');
const { randomName } = require('./testHelpers');

function loggedStreams(type) {
  return logger.sendLogToGrafana.mock.calls.map((call) => call[0].streams[0]).filter((stream) => stream.stream.type === type);
}

beforeEach(() => {
  logger.sendLogToGrafana.mockClear();
});

test('http log masks the password and token', async () => {
  const user = { name: 'pizza diner', email: randomName() + '@test.com', password: 'toomanysecrets' };
  const registerRes = await request(app).post('/api/auth').send(user);
  expect(registerRes.status).toBe(200);

  const [stream] = loggedStreams('http');
  expect(stream.stream.level).toBe('info');
  const logLine = stream.values[0][1];
  expect(logLine).not.toContain(user.password);
  expect(logLine).not.toContain(registerRes.body.token);
  expect(JSON.parse(logLine)).toMatchObject({ method: 'POST', path: '/api/auth', statusCode: 200, authorized: false, reqBody: { password: '*****' }, resBody: { token: '*****' } });
});

test('db log has the statement without its values', async () => {
  const email = randomName() + '@test.com';
  await request(app).put('/api/auth').send({ email, password: 'toomanysecrets' });

  const statements = loggedStreams('db').map((stream) => JSON.parse(stream.values[0][1]).sql);
  expect(statements).toContain('SELECT * FROM user WHERE email=?');
  expect(statements.join()).not.toContain(email);
});

test('unexpected error is logged as an exception', async () => {
  jest.spyOn(DB, 'getMenu').mockRejectedValueOnce(new Error('database is down'));
  const menuRes = await request(app).get('/api/order/menu');
  expect(menuRes.status).toBe(500);

  const [stream] = loggedStreams('exception');
  expect(stream.stream.level).toBe('error');
  expect(JSON.parse(stream.values[0][1]).message).toBe('database is down');
});

test('thrown status code error is not logged as an exception', async () => {
  const loginRes = await request(app).put('/api/auth').send({ email: randomName() + '@test.com', password: 'a' });
  expect(loginRes.status).toBe(404);
  expect(loggedStreams('exception')).toHaveLength(0);
});
