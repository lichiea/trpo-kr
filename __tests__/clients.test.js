describe('Clients API', () => {
  // Тест 8: Получение списка клиентов
  it('GET /clients should return clients list', async () => {
    const res = await request(app).get('/clients');
    expect(res.statusCode).toBe(200);
    expect(res.body.clients[0].label).toBe('Test Client');
  });

  // Тест 9: Создание клиента (только для admin/manager)
  it('POST /clients/create should require auth', async () => {
    const res = await request(app)
      .post('/clients/create')
      .send({ label: 'New Client' });
    expect(res.statusCode).toBe(401); // Нет авторизации
  });
});
