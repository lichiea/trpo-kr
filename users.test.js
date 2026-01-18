const request = require('supertest');
const app = require('../app');

describe('Users API', () => {
  it('GET /api/users should return all users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('GET /api/users should return 403 for unauthorized access', async () => {
    // Тест для проверки доступа (например, для роли employee)
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(403);
  });
});