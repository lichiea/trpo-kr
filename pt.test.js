const server = require('./app.js');
const supertest = require('supertest');
const requestWithSupertest = supertest(server);

describe('Payment Types Endpoints', () => {
  it('GET /api/payment_types should return all payment types', async () => {
    const res = await requestWithSupertest.get('/api/payment_types');
    
    expect(res.status).toEqual(200);
    expect(res.type).toEqual(expect.stringContaining('json'));
    expect(res.body).toHaveProperty('payment_types');
    expect(res.body.payment_types.length > 0).toBeTruthy();
    expect(res.body.payment_types[0]).toHaveProperty('id');
    expect(res.body.payment_types[0]).toHaveProperty('label');
  });
});