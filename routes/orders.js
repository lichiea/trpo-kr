var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_orders = user && user.id_role && user.id_role <= 3 ? true : false

    let orders = await req.db.any(`
        SELECT
            orders.id AS id,
            orders.id_status AS id_status,
            orders.creationDate AS creationDate,
            clients.fio AS client_fio,
            orders.id_client AS id_client,
            orders.totalCost AS totalCost,
            orders.plannedDate AS plannedDate,
            orders.description AS description
        FROM
            orders
        LEFT JOIN clients ON orders.id_client = clients.id
    `)
    console.log(orders)
    res.render('orders/list', { title: 'Заказы', orders: orders, can_view_orders: can_view_orders })

});

router.post('/create', async function(req, res, next) {
    let order = req.body
    await req.db.none('INSERT INTO orders(id_status, creationDate, id_client, totalCost, plannedDate, description) VALUES(${id_status}, ${creationDate}, ${id_client}, ${totalCost}, ${plannedDate}, ${description})', order);
    res.send({msg: ''})

});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid order ID');

    var user = session.auth(req).user
    var can_view_orders = user && user.id_role && user.id_role <= 3 ? true : false

    let order = await req.db.one(`
        SELECT
            orders.id AS id,
            orders.id_status AS id_status,
            orders.creationDate AS creationDate,
            clients.fio AS client_fio,
            orders.id_client AS id_client,
            orders.totalCost AS totalCost,
            orders.plannedDate AS plannedDate,
            orders.description AS description
        FROM
            orders
        LEFT JOIN clients ON orders.id_client = clients.id
        WHERE
            orders.id = ${id}
    `)

    let clientsList = await req.db.any('SELECT id, fio FROM clients ORDER BY fio');
    res.render('orders/view', { title: 'Заказ ' + order.id, order: order, clients: clientsList, can_view_orders: can_view_orders })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let order = req.body;

    try {
        await req.db.none(`
            UPDATE orders 
            SET 
                id_status = '${order.id_status}',
                creationDate = '${order.creationDate}',
                id_client = '${order.id_client}',
                totalCost = '${order.totalCost}',
                plannedDate = '${order.plannedDate}',
                description = '${order.description}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении заказа'});
    }
});


module.exports = router;