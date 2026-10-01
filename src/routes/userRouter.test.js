const request = require('supertest');
const app = require('../service');
const { randomName, expectValidJwt } = require('../testHelpers');

const dinerUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let dinerAuthToken;

beforeAll(async () => {
  dinerUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(dinerUser);
  dinerAuthToken = registerRes.body.token;
  dinerUser.id = registerRes.body.user.id;
  expectValidJwt(dinerAuthToken);
});

test('get me', async () => {
  const meRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${dinerAuthToken}`);
  expect(meRes.status).toBe(200);
  expect(meRes.body).toMatchObject({ id: dinerUser.id, name: dinerUser.name, email: dinerUser.email, roles: [{ role: 'diner' }] });
});

test('update user', async () => {
  const { user, authToken } = await registerUser();
  const updateReq = { name: randomName(), email: randomName() + '@test.com', password: randomName() };
  const updateRes = await request(app).put(`/api/user/${user.id}`).set('Authorization', `Bearer ${authToken}`).send(updateReq);
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.user).toMatchObject({ id: user.id, name: updateReq.name, email: updateReq.email });
  expectValidJwt(updateRes.body.token);

  const loginRes = await request(app).put('/api/auth').send({ email: updateReq.email, password: updateReq.password });
  expect(loginRes.status).toBe(200);
});

async function registerUser() {
  const registerRes = await request(app).post('/api/auth').send({ name: 'pizza diner', email: randomName() + '@test.com', password: 'a' });
  expectValidJwt(registerRes.body.token);
  return { user: registerRes.body.user, authToken: registerRes.body.token };
}
