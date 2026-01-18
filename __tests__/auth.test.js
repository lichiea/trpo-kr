describe('Auth API', () => {
  // Тест 5: Вход с правильными данными
  it('POST /auth/login should return token for admin', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ login: 'admin', password: 'test' }); // Пароль 'test' в MD5: 098f6bcd4621d373cade4e832627b4f6
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  // Тест 6: Вход с неправильным паролем
  it('POST /auth/login should reject invalid password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ login: 'admin', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  // Тест 7: Доступ к заказам для сотрудника
  it('Employee can view orders but not create', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ login: 'employee', password: 'test' });
    const token = loginRes.body.token;

    const ordersRes = await request(app)
      .get('/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(ordersRes.statusCode).toBe(200);

    const createRes = await request(app)
      .post('/orders/create')
      .set('Authorization', `Bearer ${token}`);
    expect(createRes.statusCode).toBe(403); // Запрещено для employee
  });
});

// Тест 10: Проверка ролей пользователей
it('Admin can access all endpoints', async () => {
  const loginRes = await request(app)
    .post('/auth/login')
    .send({ login: 'admin', password: 'test' });
  const token = loginRes.body.token;

  const clientsRes = await request(app)
    .get('/clients')
    .set('Authorization', `Bearer ${token}`);
  expect(clientsRes.statusCode).toBe(200);

  const usersRes = await request(app)
    .get('/users')
    .set('Authorization', `Bearer ${token}`);
  expect(usersRes.statusCode).toBe(200); // Только для admin
});