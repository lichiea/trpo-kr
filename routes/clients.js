var express = require('express');
var router = express.Router();

// Константы для типов
const CLIENT_TYPES = ['Физическое лицо', 'Юридическое лицо'];
const ROLES = ['Администратор', 'Менеджер', 'Бригадир', 'Клинер', 'Клиент'];
const CLEAN_OBJECT_TYPES = ['Офисное помещение', 'Дом/танхаус', 'Квартира', 'Другое'];

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user;
    var can_view_clients = user && user.id_role ? true : false;

    const searchQuery = req.query.search || '';
    
    let query = `
        SELECT
            clients.id AS id,
            clients.fio AS fio,
            clients.phone AS phone,
            clients.email AS email,
            clients.type_l AS type_l,
            clients.id_pol AS id_pol,
            users.login AS user_login
        FROM
            clients
        LEFT JOIN users ON clients.id_pol = users.id
        WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 0;
    
    if (searchQuery) {
        paramCount++;
        query += ` AND clients.fio ILIKE $${paramCount}`;
        params.push(`%${searchQuery}%`);
    }
    
    query += ` ORDER BY clients.id`;
    
    let clients = await req.db.any(query, params);
    
    res.render('clients/list', { 
        title: 'Клиенты', 
        clients: clients, 
        can_view_clients: can_view_clients,
        client_types: CLIENT_TYPES,
        current_search: searchQuery
    });
});

router.post('/create', async function(req, res, next) {
    let clientData = req.body;
    
    console.log('Create client data:', clientData);
    
    const createWithUser = clientData.login && clientData.pass;
    
    if (createWithUser) {
        if (!clientData.fio || !clientData.phone || !clientData.type_l || !clientData.login || !clientData.pass) {
            return res.send({msg: 'Обязательные поля: ФИО, телефон, тип лица, логин и пароль'});
        }
        
        if (!CLIENT_TYPES.includes(clientData.type_l)) {
            return res.send({msg: 'Неверный тип лица. Допустимые значения: ' + CLIENT_TYPES.join(', ')});
        }
        
        try {
            const existingUser = await req.db.oneOrNone(
                'SELECT id FROM users WHERE login = $1',
                [clientData.login]
            );
            
            if (existingUser) {
                return res.send({msg: 'Пользователь с таким логином уже существует'});
            }
            
            await req.db.tx(async t => {
                const newUser = await t.one(
                    'INSERT INTO users(login, pass, id_role) VALUES($1, $2, $3) RETURNING id',
                    [clientData.login, clientData.pass, 'Клиент']
                );
                
                const userId = newUser.id;
                
                await t.none(
                    `INSERT INTO clients(fio, phone, email, type_l, id_pol) 
                     VALUES($1, $2, $3, $4, $5)`,
                    [
                        clientData.fio,
                        clientData.phone,
                        clientData.email || null,
                        clientData.type_l,
                        userId
                    ]
                );
            });
            
            res.send({msg: ''});
        } catch (error) {
            console.error('Create client with user error:', error);
            res.send({msg: 'Ошибка при создании клиента: ' + error.message});
        }
    } else {
        if (!clientData.fio || !clientData.phone || !clientData.type_l) {
            return res.send({msg: 'Обязательные поля: ФИО, телефон и тип лица'});
        }

        try {
            await req.db.none(
                `INSERT INTO clients(fio, phone, email, type_l, id_pol) 
                 VALUES($1, $2, $3, $4, $5)`,
                [
                    clientData.fio,
                    clientData.phone,
                    clientData.email || null,
                    clientData.type_l,
                    clientData.id_pol || null
                ]
            );
            res.send({msg: ''});
        } catch (error) {
            console.error('Create error:', error);
            res.send({msg: 'Ошибка при создании клиента: ' + error.message});
        }
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid client ID');

    var user = session.auth(req).user;
    var can_view_clients = user && user.id_role ? true : false;

    try {
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
        `);

        let userData = await req.db.oneOrNone(`
            SELECT
                users.id AS user_id,
                users.login AS login,
                users.id_role AS role
            FROM
                users
            WHERE
                users.id = ${client.id_pol}
        `);

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
        `);

        res.render('clients/view', { 
            title: 'Клиент: ' + client.fio, 
            client: client, 
            userData: userData,
            cleanObjects: cleanObjects,
            can_view_clients: can_view_clients,
            clean_object_types: CLEAN_OBJECT_TYPES
        });

    } catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Обновление клиента - ИСПРАВЛЕННЫЙ МАРШРУТ
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let client = req.body;
    
    console.log('Update request for client ID:', id);
    console.log('Data received:', client);

    if (!client.fio || !client.phone || !client.type_l) {
        return res.send({msg: 'Обязательные поля: ФИО, телефон и тип лица'});
    }

    try {
        // Преобразуем id_pol в null если пустая строка
        let id_pol = client.id_pol;
        if (id_pol === '' || id_pol === undefined) {
            id_pol = null;
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
        `, [
            client.fio,
            client.phone,
            client.email || null,
            client.type_l,
            id_pol,
            id
        ]);
        
        console.log('Client updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении клиента: ' + error.message});
    }
});

// Маршруты для объектов клининга

// Создание объекта
router.post('/:id/clean-objects', async function(req, res) {
    let clientId = parseInt(req.params.id);
    let objectData = req.body;
    
    console.log('Create clean object for client:', clientId);
    console.log('Object data:', objectData);
    
    if (isNaN(clientId)) {
        return res.send({msg: 'Неверный ID клиента'});
    }
    
    // Валидация
    if (!objectData.type_co || !objectData.address || !objectData.squaremeterage) {
        return res.send({msg: 'Обязательные поля: тип объекта, адрес и площадь'});
    }
    
    // Проверка типа объекта
    if (!CLEAN_OBJECT_TYPES.includes(objectData.type_co)) {
        return res.send({msg: 'Неверный тип объекта. Допустимые значения: ' + CLEAN_OBJECT_TYPES.join(', ')});
    }
    
    try {
        // Проверяем, существует ли клиент
        const clientExists = await req.db.oneOrNone(
            'SELECT id FROM clients WHERE id = $1',
            [clientId]
        );
        
        if (!clientExists) {
            return res.send({msg: 'Клиент не найден'});
        }
        
        await req.db.none(`
            INSERT INTO clean_objects(type_co, id_cl, address, squaremeterage, description, floorplan) 
            VALUES($1, $2, $3, $4, $5, $6)
        `, [
            objectData.type_co,
            clientId,
            objectData.address,
            parseInt(objectData.squaremeterage),
            objectData.description || null,
            objectData.floorplan || null
        ]);
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Create clean object error:', error);
        res.send({msg: 'Ошибка при создании объекта: ' + error.message});
    }
});

// Обновление объекта
router.post('/:clientId/clean-objects/:objectId', async function(req, res) {
    let clientId = parseInt(req.params.clientId);
    let objectId = parseInt(req.params.objectId);
    let objectData = req.body;
    
    console.log('Update clean object:', objectId, 'for client:', clientId);
    console.log('Object data:', objectData);
    
    if (isNaN(clientId) || isNaN(objectId)) {
        return res.send({msg: 'Неверный ID клиента или объекта'});
    }
    
    // Валидация
    if (!objectData.type_co || !objectData.address || !objectData.squaremeterage) {
        return res.send({msg: 'Обязательные поля: тип объекта, адрес и площадь'});
    }
    
    // Проверка типа объекта
    if (!CLEAN_OBJECT_TYPES.includes(objectData.type_co)) {
        return res.send({msg: 'Неверный тип объекта. Допустимые значения: ' + CLEAN_OBJECT_TYPES.join(', ')});
    }
    
    try {
        // Проверяем, что объект принадлежит клиенту
        const objectBelongsToClient = await req.db.oneOrNone(`
            SELECT id FROM clean_objects WHERE id = $1 AND id_cl = $2
        `, [objectId, clientId]);
        
        if (!objectBelongsToClient) {
            return res.send({msg: 'Объект не найден или не принадлежит клиенту'});
        }
        
        await req.db.none(`
            UPDATE clean_objects 
            SET 
                type_co = $1,
                address = $2,
                squaremeterage = $3,
                description = $4,
                floorplan = $5
            WHERE id = $6 AND id_cl = $7
        `, [
            objectData.type_co,
            objectData.address,
            parseInt(objectData.squaremeterage),
            objectData.description || null,
            objectData.floorplan || null,
            objectId,
            clientId
        ]);
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Update clean object error:', error);
        res.send({msg: 'Ошибка при обновлении объекта: ' + error.message});
    }
});

// Удаление объекта
router.delete('/:clientId/clean-objects/:objectId', async function(req, res) {
    let clientId = parseInt(req.params.clientId);
    let objectId = parseInt(req.params.objectId);
    
    console.log('Delete clean object:', objectId, 'for client:', clientId);
    
    if (isNaN(clientId) || isNaN(objectId)) {
        return res.send({msg: 'Неверный ID клиента или объекта'});
    }
    
    try {
        // Проверяем, что объект принадлежит клиенту
        const objectBelongsToClient = await req.db.oneOrNone(`
            SELECT id FROM clean_objects WHERE id = $1 AND id_cl = $2
        `, [objectId, clientId]);
        
        if (!objectBelongsToClient) {
            return res.send({msg: 'Объект не найден или не принадлежит клиенту'});
        }
        
        await req.db.none(`
            DELETE FROM clean_objects WHERE id = $1 AND id_cl = $2
        `, [objectId, clientId]);
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete clean object error:', error);
        res.send({msg: 'Ошибка при удалении объекта: ' + error.message});
    }
});

router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for client ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID клиента'});
    }
    
    try {
        const clientExists = await req.db.oneOrNone(
            'SELECT id FROM clients WHERE id = $1',
            [id]
        );
        
        if (!clientExists) {
            return res.send({msg: 'Клиент не найден'});
        }
        
        const hasCleanObjects = await req.db.oneOrNone(
            'SELECT id FROM clean_objects WHERE id_cl = $1',
            [id]
        );
        
        if (hasCleanObjects) {
            return res.send({msg: 'Невозможно удалить клиента, так как у него есть объекты клининга. Сначала удалите объекты.'});
        }
        
        const client = await req.db.oneOrNone(
            'SELECT id_pol FROM clients WHERE id = $1',
            [id]
        );
        
        await req.db.none(
            'DELETE FROM clients WHERE id = $1',
            [id]
        );
        
        if (client && client.id_pol) {
            const userUsedElsewhere = await req.db.oneOrNone(
                'SELECT id FROM clients WHERE id_pol = $1',
                [client.id_pol]
            );
            
            if (!userUsedElsewhere) {
                await req.db.none(
                    'DELETE FROM users WHERE id = $1',
                    [client.id_pol]
                );
            }
        }
        
        console.log('Client deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении клиента: ' + error.message});
    }
});

module.exports = router;