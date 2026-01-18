var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    try {
        var user = session.auth(req).user
        var can_view_clients = user && user.id_role && user.id_role <= 2 ? true : false

        let clients = await req.db.any(`
            SELECT
                clients.id AS id,
                clients.fio AS fio,
                clients.phone AS phone,
                clients.email AS email,
                clients.type_l AS type_l,
                clients.id_pol AS id_pol
            FROM
                clients
        `)
        console.log('Clients list:', clients)
        res.render('clients/list', { 
            title: 'Клиенты', 
            clients: clients, 
            can_view_clients: can_view_clients 
        })
    } catch(err) {
        console.error('Error in clients list:', err)
        res.status(500).send('Server error')
    }
});

router.get('/:id', async function(req, res) {
    try {
        let id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).send('Invalid client ID');
        }

        console.log('Fetching client with ID:', id);
        
        var user = session.auth(req).user
        var can_view_clients = user && user.id_role && user.id_role <= 2 ? true : false

        // 1. Получаем данные клиента
        let client = await req.db.oneOrNone(`
            SELECT
                clients.id AS id,
                clients.fio AS fio,
                clients.phone AS phone,
                clients.email AS email,
                clients.type_l AS type_l,
                clients.id_pol AS id_pol
            FROM
                clients
            WHERE
                clients.id = $1
        `, [id]);

        if (!client) {
            return res.status(404).send('Клиент не найден');
        }

        console.log('Client found:', client);

        // 2. Получаем объекты уборки клиента (чистые SELECT без агрегации)
        let cleanObjects = await req.db.any(`
            SELECT
                clean_objects.id AS id,
                clean_objects.type_CO AS type_CO,
                clean_objects.address AS address,
                clean_objects.squareMeterage AS squareMeterage,
                clean_objects.description AS description,
                clean_objects.floorPlan AS floorPlan
            FROM
                clean_objects
            WHERE
                clean_objects.id_cl = $1
            ORDER BY clean_objects.id ASC
        `, [id]);

        console.log('Clean objects found:', cleanObjects.length);

        // 3. Получаем заказы клиента (чистые SELECT без агрегации)
        let orders = await req.db.any(`
            SELECT
                orders.id AS id,
                orders.id_status AS id_status,
                orders.creationDate AS creationDate,
                orders.totalCost AS totalCost,
                orders.plannedDate AS plannedDate,
                orders.description AS description
            FROM
                orders
            WHERE
                orders.id_client = $1
            ORDER BY orders.creationDate DESC, orders.id DESC
        `, [id]);

        console.log('Orders found:', orders.length);

        res.render('clients/view', { 
            title: 'Клиент: ' + client.fio, 
            client: client, 
            cleanObjects: cleanObjects,
            orders: orders,
            can_view_clients: can_view_clients 
        });

    } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

router.post('/create', async function(req, res, next) {
    try {
        let client = req.body;
        await req.db.none(
            'INSERT INTO clients(fio, phone, email, type_l, id_pol) VALUES(${fio}, ${phone}, ${email}, ${type_l}, ${id_pol})', 
            client
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).send({msg: 'Ошибка при создании клиента'});
    }
});

router.post('/update/:id', async function(req, res) {
    try {
        let id = parseInt(req.params.id);
        let client = req.body;

        if (isNaN(id)) {
            return res.status(400).send('Invalid client ID');
        }

        await req.db.none(`
            UPDATE clients 
            SET 
                fio = $1,
                phone = $2,
                email = $3,
                type_l = $4,
                id_pol = $5
            WHERE id = $6
        `, [client.fio, client.phone, client.email, client.type_l, client.id_pol, id]);
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Error updating client:', error);
        res.send({msg: 'Ошибка при обновлении клиента'});
    }
});

module.exports = router;