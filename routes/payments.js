var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    let payments = await req.db.any(`
        SELECT
            payments.id AS id,
            orders.label AS order_label,
            payment_types.label AS payment_type_label,
            payments.amount AS amount
        FROM
            payments
        INNER JOIN
            payment_types ON payment_types.id = payments.id_payment_type
        INNER JOIN
            orders ON orders.id = payments.id_order
    `)
    console.log(payments)
     let orders = await req.db.any(`
        SELECT
            *
        FROM
            orders
    `)
    console.log(orders)

     let payment_types = await req.db.any(`
        SELECT 
            * 
        FROM 
            payment_types
    `)

    res.render('payments/list', { title: 'Платежи', payments: payments, orders: orders, payment_types: payment_types})

});

router.post('/create', async function(req, res, next) {

    let payment = req.body

    await req.db.none('INSERT INTO payments(id_order, id_payment_type, amount) VALUES(${id_order}, ${id_payment_type}, ${amount})', payment);

    res.send({msg: ''})

});

router.get('/:id', async function(req, res) {
    let id = req.params.id
    let payment = await req.db.one(`
        SELECT
            payments.id AS id,
            orders.label AS order_label,
            payment_types.label AS payment_type_label,
            payments.amount AS amount
        FROM
            payments
        INNER JOIN
            orders ON orders.id = payments.id_order
        INNER JOIN
            payment_types ON payment_types.id = payments.id_payment_type
        WHERE
            payments.id = ${id}
    `)
    res.render('payments/view', { 
        title: 'Платеж #' + payment.id, 
        payment: payment 
    })
});

module.exports = router;

