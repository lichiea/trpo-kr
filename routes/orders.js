var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_users = user && user.id_role == 1 ? true : false
    var can_view_payments = user && user.id_role <= 2 ? true : false

    let orders = await req.db.any(`
        SELECT
            orders.id AS id,
            orders.label AS label,
            order_statuses.label AS order_status_label,
            clients.label AS client_label,
            orders.amount AS amount
        FROM
            orders
        INNER JOIN
            clients ON clients.id = orders.id_client
        INNER JOIN
            order_statuses ON order_statuses.id = orders.id_status
    `)
    console.log(orders)
     let clients = await req.db.any(`
        SELECT
            *
        FROM
            clients
    `)
    console.log(clients)

     let order_statuses = await req.db.any(`
        SELECT
            *
        FROM
            order_statuses
    `)
    res.render('orders/list', { title: 'Заказы', orders: orders, clients: clients, order_statuses: order_statuses, can_view_payments: can_view_payments })

});

router.post('/create', async function(req, res, next) {
    if (!req.user || req.user.id_role !== 3) { // 3 = employee
      return res.status(403).send('Доступ запрещён');
    }

    let order = req.body

    await req.db.none('INSERT INTO orders(label, id_client, amount) VALUES(${label}, ${id_client}, ${amount})', order);

    res.send({msg: ''})

});


router.get('/:id', async function(req, res) {

    let id = req.params.id

    var user = session.auth(req).user
    var can_view_users = user && user.id_role == 1 ? true : false
    var can_view_payments = user && user.id_role <= 2 ? true : false

    let order = await req.db.one(`
        SELECT
            orders.id AS id,
            orders.label AS label,
            order_statuses.label AS order_status_label,
            clients.label AS client_label,
            orders.amount AS amount
        FROM
            orders
        INNER JOIN
            clients ON clients.id = orders.id_client
        INNER JOIN
            order_statuses ON order_statuses.id = orders.id_status
        WHERE
            orders.id = ${id}
    `)

    let order_statuses = await req.db.any(`
        SELECT 
            * 
        FROM 
            order_statuses
    `)

    let clients = await req.db.any(`
        SELECT 
            * 
        FROM 
            clients
    `)

    let order_items = await req.db.any(`
        SELECT 
            order_items.id AS id,
            order_items.label AS label,
            order_items.id AS id_order,
            order_items.amount AS amount 
        FROM 
            order_items
    `)

    res.render('orders/view', { title: 'Заказ'+ "   " + order.label, order: order, order_statuses: order_statuses, clients: clients, can_view_payments: can_view_payments, can_view_users: can_view_users, order_items: order_items })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let order = req.body;

    try {
        await req.db.none(`
            UPDATE orders 
            SET 
                label = '${order.label}',
                id_client = ${order.id_client},
                id_status = ${order.id_status},
                amount = ${order.amount}
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении заказа'});
    }
});


module.exports = router;
