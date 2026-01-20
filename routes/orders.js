var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user
    var can_view_orders = user && user.id_role ? true : false

    let orders = await req.db.any(`
        SELECT
            orders.id AS id,
            orders.id_status AS status,
            orders.creationDate AS creationDate,
            orders.id_client AS id_client,
            orders.totalCost AS totalCost,
            orders.plannedDate AS plannedDate,
            orders.description AS description,
            clients.fio AS client_fio  -- Исправлено с clients.name на clients.fio
        FROM
            orders
        LEFT JOIN clients ON orders.id_client = clients.id
        ORDER BY orders.creationDate DESC
    `)
    
    console.log(orders)
    res.render('orders/list', { 
        title: 'Заказы', 
        orders: orders, 
        can_view_orders: can_view_orders 
    })
});

router.post('/create', async function(req, res, next) {
    let order = req.body;
    
    // Валидация
    if (!order.id_client || !order.totalCost) {
        return res.send({msg: 'Обязательные поля: клиент и общая стоимость'});
    }

    try {
        // Преобразуем даты
        const creationDate = order.creationDate ? new Date(order.creationDate) : new Date();
        const plannedDate = order.plannedDate ? new Date(order.plannedDate) : null;
        
        await req.db.none(
            `INSERT INTO orders(
                id_status, 
                creationDate, 
                id_client, 
                totalCost, 
                plannedDate, 
                description
            ) VALUES(
                COALESCE($1, 'Новый'),
                $2,
                $3,
                $4,
                $5,
                $6
            )`, 
            [
                order.id_status || 'Новый',
                creationDate,
                order.id_client,
                order.totalCost,
                plannedDate,
                order.description || null
            ]
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании заказа: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid order ID');

    var user = session.auth(req).user
    var can_view_orders = user && user.id_role ? true : false

    try {
        // Получаем данные заказа с ФИО клиента
        let order = await req.db.one(`
            SELECT
                orders.id AS id,
                orders.id_status AS status,
                orders.creationDate AS creationDate,
                orders.id_client AS id_client,
                orders.totalCost AS totalCost,
                orders.plannedDate AS plannedDate,
                orders.description AS description,
                clients.fio AS client_fio  -- Исправлено с clients.name на clients.fio
            FROM
                orders
            LEFT JOIN clients ON orders.id_client = clients.id
            WHERE
                orders.id = ${id}
        `)

        // Получаем услуги в заказе
        let orderItems = await req.db.any(`
            SELECT
                orders_items.id AS item_id,
                services.name AS service_name,
                services.description AS service_description,
                services.cost AS service_cost
            FROM
                orders_items
            LEFT JOIN services ON orders_items.id_serv = services.id
            WHERE
                orders_items.id_order = ${id}
        `)

        // Получаем список всех клиентов для выпадающего списка
        let clients = await req.db.any(`
            SELECT id, fio FROM clients ORDER BY fio  -- Исправлено с name на fio
        `)

        // Получаем список всех статусов из ENUM
        let statuses = await req.db.any(`
            SELECT unnest(enum_range(NULL::order_statuses)) AS status
        `)

        res.render('orders/view', { 
            title: 'Заказ #' + order.id, 
            order: order, 
            orderItems: orderItems,
            clients: clients,
            statuses: statuses,
            can_view_orders: can_view_orders 
        })

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Добавляем роут для получения списка клиентов (для модального окна)
router.get('/clients/list', async function(req, res) {
    try {
        let clients = await req.db.any(`
            SELECT id, fio FROM clients ORDER BY fio  -- Исправлено с name на fio
        `);
        res.json(clients);
    } catch (error) {
        console.error('Error loading clients:', error);
        res.status(500).json({ error: 'Ошибка загрузки клиентов' });
    }
});

// Роут для обновления заказа
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let order = req.body;
    
    console.log('Update request for order ID:', id);
    console.log('Data received:', order);

    // Валидация
    if (!order.id_client || !order.totalCost) {
        return res.send({msg: 'Обязательные поля: клиент и общая стоимость'});
    }

    try {
        // Преобразуем даты
        const creationDate = order.creationDate ? new Date(order.creationDate) : null;
        const plannedDate = order.plannedDate ? new Date(order.plannedDate) : null;
        
        await req.db.none(`
            UPDATE orders 
            SET 
                id_status = $1,
                creationDate = $2,
                id_client = $3,
                totalCost = $4,
                plannedDate = $5,
                description = $6
            WHERE id = $7
        `, [
            order.status || 'Новый',
            creationDate,
            order.id_client,
            order.totalCost,
            plannedDate,
            order.description || null,
            id
        ]);
        
        console.log('Order updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении заказа: ' + error.message});
    }
});

// Роут для удаления заказа
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for order ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID заказа'});
    }
    
    try {
        // Проверяем, существует ли заказ
        const orderExists = await req.db.oneOrNone(
            'SELECT id FROM orders WHERE id = $1',
            [id]
        );
        
        if (!orderExists) {
            return res.send({msg: 'Заказ не найден'});
        }
        
        // Сначала удаляем связанные записи из orders_items
        await req.db.none(
            'DELETE FROM orders_items WHERE id_order = $1',
            [id]
        );
        
        // Затем удаляем сам заказ
        await req.db.none(
            'DELETE FROM orders WHERE id = $1',
            [id]
        );
        
        console.log('Order deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении заказа: ' + error.message});
    }
});

module.exports = router;