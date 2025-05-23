var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {

    var user = session.auth(req).user
    var can_view_users = user && user.id_role == 1 ? true : false
    var can_view_orders = user && user.id_role <= 3 ? true : false
    var can_view_payments = user && user.id_role <= 2 ? true : false
    var can_view_clients = true

    res.render('index', {
        title:  "Главная страница",
        user:   user,
        can_view_users: can_view_users,
        can_view_orders: can_view_orders,
        can_view_payments: can_view_payments,
        can_view_clients: can_view_clients,
    })


});

module.exports = router;
