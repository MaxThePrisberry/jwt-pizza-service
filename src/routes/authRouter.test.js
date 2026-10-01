const request = require('supertest');
const app = require('../service');
const { randomName, expectValidJwt } = require('../testHelpers');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('register without name, email, or password', async () => {
  for (const user of [{ email: 'a@test.com', password: 'a' }, { name: 'a', password: 'a' }, { name: 'a', email: 'a@test.com' }]) {
    const registerRes = await request(app).post('/api/auth').send(user);
    expect(registerRes.status).toBe(400);
  }
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});
