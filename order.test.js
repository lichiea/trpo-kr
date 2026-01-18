describe('Orders API', () => {
  it('POST /api/orders should create a new order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ clientId: 1, items: [{ productId: 1, quantity: 2 }] });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('orderId');
  });

  it('GET /api/orders should return list of orders', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('orders');
  });
});