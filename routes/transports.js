var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user
    var can_view_transports = user && user.id_role ? true : false

    let transports = await req.db.any(`
        SELECT
            transports.id AS id,
            transports.model AS model,
            transports.registrationNumber AS registrationNumber
        FROM
            transports
    `)
    console.log(transports)
    res.render('transports/list', { title: 'Транспортные средства', transports: transports, can_view_transports: can_view_transports })
});

router.post('/create', async function(req, res, next) {
    let transport = req.body;
    
    // Валидация
    if (!transport.model || !transport.registrationNumber) {
        return res.send({msg: 'Обязательные поля: модель и регистрационный номер'});
    }

    try {
        await req.db.none(
            'INSERT INTO transports(model, registrationNumber) VALUES(${model}, ${registrationNumber})', 
            transport
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании транспортного средства: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid transport ID');

    var user = session.auth(req).user
    var can_view_transports = user && user.id_role ? true : false

    try {
        // Получаем данные транспортного средства
        let transport = await req.db.one(`
            SELECT
                transports.id AS id,
                transports.model AS model,
                transports.registrationNumber AS registrationNumber
            FROM
                transports
            WHERE
                transports.id = ${id}
        `)

        res.render('transports/view', { 
            title: 'Транспортное средство: ' + transport.model, 
            transport: transport, 
            can_view_transports: can_view_transports 
        })

    } catch (error) {
        console.error('Error fetching transport details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для обновления транспортного средства
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let transport = req.body;
    
    console.log('Update request for transport ID:', id);
    console.log('Data received:', transport);

    // Валидация
    if (!transport.model || !transport.registrationNumber) {
        return res.send({msg: 'Обязательные поля: модель и регистрационный номер'});
    }

    try {
        await req.db.none(`
            UPDATE transports 
            SET 
                model = $1,
                registrationNumber = $2
            WHERE id = $3
        `, [
            transport.model,
            transport.registrationNumber,
            id
        ]);
        
        console.log('Transport updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении транспортного средства: ' + error.message});
    }
});

// Роут для удаления транспортного средства
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for transport ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID транспортного средства'});
    }
    
    try {
        // Проверяем, существует ли транспортное средство
        const transportExists = await req.db.oneOrNone(
            'SELECT id FROM transports WHERE id = $1',
            [id]
        );
        
        if (!transportExists) {
            return res.send({msg: 'Транспортное средство не найдено'});
        }
        
        // Удаляем транспортное средство
        await req.db.none(
            'DELETE FROM transports WHERE id = $1',
            [id]
        );
        
        console.log('Transport deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении транспортного средства: ' + error.message});
    }
});

module.exports = router;