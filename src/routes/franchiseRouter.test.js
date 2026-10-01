const request = require('supertest');
const app = require('../service');
const { randomName, createAdminUser, expectValidJwt } = require('../testHelpers');

const dinerUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let dinerAuthToken;
let adminUser;
let adminAuthToken;

beforeAll(async () => {
  dinerUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(dinerUser);
  dinerAuthToken = registerRes.body.token;
  expectValidJwt(dinerAuthToken);

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

test('create franchise without name or admins', async () => {
  for (const franchiseReq of [{ name: randomName() }, { admins: [{ email: adminUser.email }] }]) {
    const createRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send(franchiseReq);
    expect(createRes.status).toBe(400);
  }
});

test('list franchises', async () => {
  const franchise = await createFranchise();
  const listRes = await request(app).get(`/api/franchise?page=0&limit=10&name=${franchise.name}`);
  expect(listRes.status).toBe(200);
  expect(listRes.body).toMatchObject({ franchises: [{ id: franchise.id, name: franchise.name }], more: false });
});

test('list franchises with bad paging', async () => {
  for (const query of ['limit=abc', 'limit=0', 'limit=101', 'page=-1', 'page=1.5']) {
    const listRes = await request(app).get(`/api/franchise?${query}`);
    expect(listRes.status).toBe(400);
  }
});

test('delete franchise', async () => {
  const franchise = await createFranchise();
  const deleteRes = await request(app).delete(`/api/franchise/${franchise.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body).toEqual({ message: 'franchise deleted' });

  const listRes = await request(app).get(`/api/franchise?name=${franchise.name}`);
  expect(listRes.body.franchises).toEqual([]);
});

test('delete franchise without auth', async () => {
  const franchise = await createFranchise();
  const deleteRes = await request(app).delete(`/api/franchise/${franchise.id}`);
  expect(deleteRes.status).toBe(401);
});

test('delete franchise as diner', async () => {
  const franchise = await createFranchise();
  const deleteRes = await request(app).delete(`/api/franchise/${franchise.id}`).set('Authorization', `Bearer ${dinerAuthToken}`);
  expect(deleteRes.status).toBe(403);
});

test('create store for unknown franchise', async () => {
  const franchiseId = await deletedFranchiseId();
  const createRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send({ name: randomName() });
  expect(createRes.status).toBe(404);
});

test('delete store for unknown franchise', async () => {
  const franchiseId = await deletedFranchiseId();
  const deleteRes = await request(app).delete(`/api/franchise/${franchiseId}/store/1`).set('Authorization', `Bearer ${adminAuthToken}`);
  expect(deleteRes.status).toBe(404);
});

async function deletedFranchiseId() {
  const franchise = await createFranchise();
  const deleteRes = await request(app).delete(`/api/franchise/${franchise.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
  expect(deleteRes.status).toBe(200);
  return franchise.id;
}

async function createFranchise() {
  const franchiseReq = { name: randomName(), admins: [{ email: adminUser.email }] };
  const createRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send(franchiseReq);
  expect(createRes.status).toBe(200);
  return createRes.body;
}
