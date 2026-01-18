const server = require('./app.js');
const supertest = require('supertest');
const requestWithSupertest = supertest(server);

describe('User Endpoints', () => {

  it('GET /user should show all users', async () => {
    const res = await requestWithSupertest.get('/api/users');

      expect(res.status).toEqual(200);
      expect(res.type).toEqual(expect.stringContaining('json'));
      expect(res.body).toHaveProperty('users')
      expect(res.body.users.length > 0)
      expect(res.body.users[0]).toHaveProperty('id')
      expect(res.body.users[0]).toHaveProperty('login')
      expect(res.body.users[0]).toHaveProperty('fio')
      expect(res.body.users[0]).toHaveProperty('role_label')
  });

  it('GET /client should show all client', async () => {
    const res = await requestWithSupertest.get('/clients');

      expect(res.status).toEqual(200);
      expect(res.type).toEqual(expect.stringContaining('json'));
      expect(res.body).toHaveProperty('users')
      expect(res.body.clients.length > 0)
      expect(res.body.clients[0]).toHaveProperty('id')
      expect(res.body.clients[0]).toHaveProperty('label')
  });

});