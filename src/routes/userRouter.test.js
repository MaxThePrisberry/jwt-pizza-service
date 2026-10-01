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
