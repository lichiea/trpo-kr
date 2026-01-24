var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {

    var user = session.auth(req).user
    var can_view_users = false;
    var can_view_orders = true;
    var can_view_services = true;
    var can_view_clients = false;
    var can_view_employees = false;
    var can_view_pricelists = false;
    var can_view_equipments = false;
    var can_view_teams = false;
    var can_view_transports = false;
    if (user && user.id_role == 'Администратор'){
        can_view_services = true;
        can_view_users = true;
        can_view_orders = true;
        can_view_employees = true;
        can_view_pricelists = true;
        can_view_equipments = true;
        can_view_transports = true;
    }
    if (user && user.id_role == 'Менеджер'){
        can_view_orders = true;
        can_view_clients = true;
        can_view_employees = true;
        can_view_teams = true;
        can_view_services = true;
    }
    if (user && user.id_role == 'Бригадир'){
        can_view_orders = true;
        can_view_clients = true;
        can_view_employees = true;
        can_view_teams = true;
        can_view_services = true;        
    }
    if (user && user.id_role == 'Клинер'){
        can_view_orders = true;
        can_view_services = true;
    }
    if (user && user.id_role == 'Клиент'){
        can_view_orders = true;
        can_view_services = true;
    }

    res.render('index', {
        title:  "Главная страница",
        user:   user,
        can_view_users: can_view_users,
        can_view_orders: can_view_orders,
        can_view_services: can_view_services,
        can_view_clients: can_view_clients,
        can_view_employees: can_view_employees,
        can_view_pricelists: can_view_pricelists,
        can_view_equipments: can_view_equipments,
        can_view_teams: can_view_teams,
        can_view_transports: can_view_transports
    })


});

module.exports = router;
