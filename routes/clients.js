var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_clients = user && user.id_role ? true : false

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
    console.log(clients)
    res.render('clients/list', { title: 'Клиенты', clients: clients, can_view_clients: can_view_clients })

});

router.post('/create', async function(req, res, next) {
    let client = req.body;
    
    // Валидация
    if (!client.fio || !client.phone || !client.type_l) {
        return res.send({msg: 'Обязательные поля: ФИО, телефон и тип лица'});
    }

    try {
        await req.db.none(
            'INSERT INTO clients(fio, phone, email, type_l, id_pol) VALUES(${fio}, ${phone}, ${email}, ${type_l}, ${id_pol})', 
            client
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании клиента: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid client ID');

    var user = session.auth(req).user
    var can_view_clients = user && user.id_role ? true : false

    try {
        // Получаем данные клиента
        let client = await req.db.one(`
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
                clients.id = ${id}
        `)

        // Получаем данные пользователя (логин и роль) из таблицы users
        let userData = await req.db.oneOrNone(`
            SELECT
                users.id AS user_id,
                users.login AS login,
                users.id_role AS role
            FROM
                users
            WHERE
                users.id = ${client.id_pol}
        `)

        // Получаем объекты клининга клиента
        let cleanObjects = await req.db.any(`
            SELECT
                clean_objects.id AS id,
                clean_objects.type_co AS type_co,
                clean_objects.address AS address,
                clean_objects.squaremeterage AS squaremeterage,
                clean_objects.description AS description,
                clean_objects.floorplan AS floorplan
            FROM
                clean_objects
            WHERE
                clean_objects.id_cl = ${id}
        `)

        res.render('clients/view', { 
            title: 'Клиент: ' + client.fio, 
            client: client, 
            userData: userData,
            cleanObjects: cleanObjects,
            can_view_clients: can_view_clients 
        })

    } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }

});

// Роут для обновления клиента
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let client = req.body;
    
    console.log('Update request for client ID:', id);
    console.log('Data received:', client);

    // Валидация
    if (!client.fio || !client.phone || !client.type_l) {
        return res.send({msg: 'Обязательные поля: ФИО, телефон и тип лица'});
    }

    try {
        // Используйте параметризованный запрос
        await req.db.none(`
            UPDATE clients 
            SET 
                fio = $1,
                phone = $2,
                email = $3,
                type_l = $4,
                id_pol = $5
            WHERE id = $6
        `, [
            client.fio,
            client.phone,
            client.email || null,
            client.type_l,
            client.id_pol || null,
            id
        ]);
        
        console.log('Client updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении клиента: ' + error.message});
    }
});

// Роут для удаления клиента
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for client ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID клиента'});
    }
    
    try {
        // Проверяем, существует ли клиент
        const clientExists = await req.db.oneOrNone(
            'SELECT id FROM clients WHERE id = $1',
            [id]
        );
        
        if (!clientExists) {
            return res.send({msg: 'Клиент не найден'});
        }
        
        // Проверяем, есть ли у клиента объекты клининга
        const hasCleanObjects = await req.db.oneOrNone(
            'SELECT id FROM clean_objects WHERE id_cl = $1',
            [id]
        );
        
        if (hasCleanObjects) {
            return res.send({msg: 'Невозможно удалить клиента, так как у него есть объекты клининга. Сначала удалите объекты.'});
        }
        
        // Удаляем клиента
        await req.db.none(
            'DELETE FROM clients WHERE id = $1',
            [id]
        );
        
        console.log('Client deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении клиента: ' + error.message});
    }
});

module.exports = router;