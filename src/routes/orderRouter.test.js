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
  const newStore = await createStore();
  const items = [{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }, { menuId: 0, description: 'missing pizza', price: 0 }];
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send({ franchiseId: franchise.id, storeId: newStore.id, items });
  expect(orderRes.status).toBe(404);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(await storeRevenue(newStore.id)).toBe(0);
});

test('create order without franchise, store, or items', async () => {
  const items = [{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }];
  for (const orderReq of [{ storeId: store.id, items }, { franchiseId: franchise.id, items }, { franchiseId: franchise.id, storeId: store.id }, { franchiseId: franchise.id, storeId: store.id, items: [] }, { franchiseId: franchise.id, storeId: store.id, items: [{}] }]) {
    const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send(orderReq);
    expect(orderRes.status).toBe(400);
  }
  expect(global.fetch).not.toHaveBeenCalled();
});

test('create order for unknown store', async () => {
  const items = [{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }];
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${dinerAuthToken}`).send({ franchiseId: franchise.id, storeId: 0, items });
  expect(orderRes.status).toBe(404);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('create order when factory fails', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ reportUrl: 'factoryreport' }) }));
  const authToken = await registerDiner();
  const items = [{ menuId: menuItem.id, description: menuItem.title, price: menuItem.price }];
  const orderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${authToken}`).send({ franchiseId: franchise.id, storeId: store.id, items });
  expect(orderRes.status).toBe(500);
  expect(orderRes.body).toEqual({ message: 'Failed to fulfill order at factory', followLinkToEndChaos: 'factoryreport' });

  const ordersRes = await request(app).get('/api/order').set('Authorization', `Bearer ${authToken}`);
  expect(ordersRes.body.orders).toEqual([]);
});

async function registerDiner() {
  const registerRes = await request(app).post('/api/auth').send({ name: 'pizza diner', email: randomName() + '@test.com', password: 'a' });
  expectValidJwt(registerRes.body.token);
  return registerRes.body.token;
}

async function createStore() {
  const storeRes = await request(app).post(`/api/franchise/${franchise.id}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send({ name: randomName() });
  expect(storeRes.status).toBe(200);
  return storeRes.body;
}

async function storeRevenue(storeId) {
  const listRes = await request(app).get(`/api/franchise?name=${franchise.name}`).set('Authorization', `Bearer ${adminAuthToken}`);
  return listRes.body.franchises[0].stores.find((s) => s.id === storeId).totalRevenue;
}
