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

test('edited token is rejected', async () => {
  const meRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(meRes.status).toBe(200);

  const [header, payload, signature] = testUserAuthToken.split('.');
  const user = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const adminPayload = Buffer.from(JSON.stringify({ ...user, roles: [{ role: 'admin' }] })).toString('base64url');
  const editedRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${header}.${adminPayload}.${signature}`);
  expect(editedRes.status).toBe(401);
});

test('logout', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const authToken = loginRes.body.token;
  expectValidJwt(authToken);

  const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${authToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body).toEqual({ message: 'logout successful' });

  const meRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${authToken}`);
  expect(meRes.status).toBe(401);
});
