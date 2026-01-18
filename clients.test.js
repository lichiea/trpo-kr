const server = require('./app.js');
const supertest = require('supertest');
const requestWithSupertest = supertest(server);

describe('Clients Endpoints', () => {
  it('GET /clients should return all clients', async () => {
    const res = await requestWithSupertest.get('/clients');
    
    expect(res.status).toEqual(200);
    expect(res.type).toEqual(expect.stringContaining('json'));
    expect(res.body).toHaveProperty('clients');
    expect(res.body.clients.length > 0).toBeTruthy();
    expect(res.body.clients[0]).toHaveProperty('id');
    expect(res.body.clients[0]).toHaveProperty('label');
  });
});