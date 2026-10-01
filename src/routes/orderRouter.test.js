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

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ jwt: 'factoryjwt', reportUrl: 'factoryreport' }) }));
});

test('create order', async () => {
  const orderReq = { franchiseId: franchise.id, storeId: store.id, items: [{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }] };
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send(orderReq);
  expect(orderRes.status).toBe(200);
  expect(orderRes.body).toMatchObject({ order: orderReq, followLinkToEndChaos: 'factoryreport', jwt: 'factoryjwt' });
  expect(global.fetch).toHaveBeenCalledWith(`${config.factory.url}/api/order`, expect.objectContaining({ method: 'POST' }));
});

test('create order uses menu price', async () => {
  const newStore = await createStore();
  const orderReq = { franchiseId: franchise.id, storeId: newStore.id, items: [{ menuId: menuItem.id, description: 'free pizza', price: 0 }] };
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send(orderReq);
  expect(orderRes.status).toBe(200);
  expect(orderRes.body.order.items).toEqual([{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }]);
  expect(await storeRevenue(newStore.id)).toBe(menuItem.price);
});

test('create order with unknown menu item', async () => {
  const orderReq = { franchiseId: franchise.id, storeId: store.id, items: [{ menuId: 0, description: 'missing pizza', price: 0 }] };
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send(orderReq);
  expect(orderRes.status).toBe(404);
  expect(global.fetch).not.toHaveBeenCalled();
});

async function createStore() {
  const storeRes = await request(app).post(`/api/franchise/${franchise.id}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send({ name: randomName() });
  expect(storeRes.status).toBe(200);
  return storeRes.body;
}

async function storeRevenue(storeId) {
  const listRes = await request(app).get(`/api/franchise?name=${franchise.name}`).set('Authorization', `Bearer ${adminAuthToken}`);
  return listRes.body.franchises[0].stores.find((s) => s.id === storeId).totalRevenue;
}
