const request = require('supertest');
const app = require('../service');
const config = require('../config.js');
const { randomName, createAdminUser, expectValidJwt } = require('../testHelpers');

const dinerUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let dinerAuthToken;
let adminAuthToken;
let menuItem;
let franchise;
let store;

beforeAll(async () => {
  dinerUser.email = randomName() + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(dinerUser);
  dinerAuthToken = registerRes.body.token;
  expectValidJwt(dinerAuthToken);

  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send(adminUser);
  adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);

  const menuReq = { title: randomName(), description: 'test pizza', image: 'pizza1.png', price: 0.0042 };
  const menuRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(menuReq);
  menuItem = menuRes.body.find((item) => item.title === menuReq.title);

  const franchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send({ name: randomName(), admins: [{ email: adminUser.email }] });
  franchise = franchiseRes.body;
  const storeRes = await request(app).post(`/api/franchise/${franchise.id}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send({ name: randomName() });
  store = storeRes.body;
});

test('create order', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ jwt: 'factoryjwt', reportUrl: 'factoryreport' }) }));
  const orderReq = { franchiseId: franchise.id, storeId: store.id, items: [{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }] };
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send(orderReq);
  expect(orderRes.status).toBe(200);
  expect(orderRes.body).toMatchObject({ order: orderReq, followLinkToEndChaos: 'factoryreport', jwt: 'factoryjwt' });
  expect(global.fetch).toHaveBeenCalledWith(`${config.factory.url}/api/order`, expect.objectContaining({ method: 'POST' }));
});
