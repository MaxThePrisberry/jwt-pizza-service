const request = require('supertest');
const app = require('./service');
const { DB } = require('./database/database.js');

beforeAll(async () => {
  await DB.initialized;
});

test('error response has no stack', async () => {
  const errorRes = await request(app).get('/api/franchise?limit=abc');
  expect(errorRes.status).toBe(400);
  expect(errorRes.body).toEqual({ message: 'invalid page or limit' });
});
