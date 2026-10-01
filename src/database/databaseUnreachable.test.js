const config = require('../config.js');

jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
}));

test('database setup failure does not log the password', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { DB } = require('./database.js');
  await DB.initialized;

  expect(consoleError).toHaveBeenCalled();
  expect(consoleError.mock.calls[0][0].includes(config.db.connection.password)).toBe(false);
});
