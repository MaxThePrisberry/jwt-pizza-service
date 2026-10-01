const request = require('supertest');
const app = require('../service');
const { randomName, createAdminUser, expectValidJwt } = require('../testHelpers');

let adminUser;
let adminAuthToken;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
});

test('create franchise', async () => {
  const franchiseReq = { name: randomName(), admins: [{ email: adminUser.email }] };
  const createRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send(franchiseReq);
  expect(createRes.status).toBe(200);
  expect(createRes.body).toMatchObject({ name: franchiseReq.name, admins: [{ id: adminUser.id, name: adminUser.name, email: adminUser.email }] });
});
