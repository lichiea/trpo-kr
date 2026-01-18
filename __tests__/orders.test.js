const request = require('supertest');
const app = require('../app'); // Убедитесь, что путь правильный
//const db = require('../db'); // Подключение к БД

describe('Orders API', () => {
 // beforeAll(async () => {
  //  // Можно добавить тестовые данные перед запуском тестов
  //  await db.none('TRUNCATE TABLE orders RESTART IDENTITY CASCADE');
  //  await db.none('INSERT INTO clients(label) VALUES($1)', ['Test Client']);
 // });

  // Тест 1: Получение списка заказов
  it('GET /orders should return all orders', async () => {
    const res = await request(app).get('/orders');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  // Тест 2: Создание заказа
  it('POST /orders/create should create a new order', async () => {
    const newOrder = {
      label: 'Test Order',
      id_client: 1,
      amount: 100.50
    };
    const res = await request(app)
      .post('/orders/create')
      .send(newOrder);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('msg', '');
  });

  // Тест 3: Просмотр конкретного заказа
  it('GET /orders/:id should return an order by ID', async () => {
    const orderId = 1; // Предполагаем, что заказ с ID=1 существует
    const res = await request(app).get(`/orders/${orderId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order.id).toBe(orderId);
  });


});