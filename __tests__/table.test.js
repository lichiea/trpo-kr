const server = require('./app.js');
const supertest = require('supertest');
const requestWithSupertest = supertest(server);

describe('User Endpoints', () => {

  it('GET /orders should show all users', async () => {
    const res = await requestWithSupertest.get('/orders');

      expect(res.status).toEqual(200);
      expect(res.type).toEqual(expect.stringContaining('json'));
      expect(res.body).toHaveProperty('orders')
      expect(res.body.orders.length > 0)
      expect(res.body.orders[0]).toHaveProperty('id')
      expect(res.body.orders[0]).toHaveProperty('label')
      expect(res.body.orders[0]).toHaveProperty('order_status_label')
      expect(res.body.orders[0]).toHaveProperty('client_label')
      expect(res.body.orders[0]).toHaveProperty('amount')
  });

  it('GET /client should show all client', async () => {
    const res = await requestWithSupertest.get('/clients');

      expect(res.status).toEqual(200);
      expect(res.type).toEqual(expect.stringContaining('json'));
      expect(res.body).toHaveProperty('clients')
      expect(res.body.clients.length > 0)
      expect(res.body.clients[0]).toHaveProperty('id')
      expect(res.body.clients[0]).toHaveProperty('label')
  });

});