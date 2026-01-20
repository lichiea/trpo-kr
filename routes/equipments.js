var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user
    var can_view_equipments = user && user.id_role ? true : false

    let equipments = await req.db.any(`
        SELECT
            equipments.id AS id,
            equipments.label AS label,
            equipments.description AS description
        FROM
            equipments
        ORDER BY id ASC  -- Сортировка по возрастанию ID
    `)
    console.log(equipments)
    res.render('equipments/list', { 
        title: 'Инвентарь', 
        equipments: equipments, 
        can_view_equipments: can_view_equipments 
    })
});

router.post('/create', async function(req, res, next) {
    let equipment = req.body;
    
    // Валидация
    if (!equipment.label) {
        return res.send({msg: 'Обязательное поле: Наименование'});
    }

    try {
        await req.db.none(
            'INSERT INTO equipments(label, description) VALUES(${label}, ${description})', 
            equipment
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании инвентаря: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid equipment ID');

    var user = session.auth(req).user
    var can_view_equipments = user && user.id_role ? true : false

    try {
        // Получаем данные инвентаря
        let equipment = await req.db.one(`
            SELECT
                equipments.id AS id,
                equipments.label AS label,
                equipments.description AS description
            FROM
                equipments
            WHERE
                equipments.id = ${id}
        `)

        // Получаем услуги, которые используют это Инвентарь
        let services = await req.db.any(`
            SELECT
                services.id AS id,
                services.label AS label,
                services.description AS description
            FROM
                services
            WHERE
                services.id_equip = ${id}
            ORDER BY services.id ASC  -- Сортировка услуг по возрастанию ID
        `)

        res.render('equipments/view', { 
            title: 'Инвентарь: ' + equipment.label, 
            equipment: equipment, 
            services: services,
            can_view_equipments: can_view_equipments 
        })

    } catch (error) {
        console.error('Error fetching equipment details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для обновления инвентаря
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let equipment = req.body;
    
    console.log('Update request for equipment ID:', id);
    console.log('Data received:', equipment);

    // Валидация
    if (!equipment.label) {
        return res.send({msg: 'Обязательное поле: Наименование'});
    }

    try {
        await req.db.none(`
            UPDATE equipments 
            SET 
                label = $1,
                description = $2
            WHERE id = $3
        `, [
            equipment.label,
            equipment.description || null,
            id
        ]);
        
        console.log('Equipment updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении инвентаря: ' + error.message});
    }
});

// Роут для удаления инвентаря
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for equipment ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID инвентаря'});
    }
    
    try {
        // Проверяем, существует ли Инвентарь
        const equipmentExists = await req.db.oneOrNone(
            'SELECT id FROM equipments WHERE id = $1',
            [id]
        );
        
        if (!equipmentExists) {
            return res.send({msg: 'Инвентарь не найдено'});
        }
        
        // Проверяем, используется ли Инвентарь в услугах
        const usedInServices = await req.db.oneOrNone(
            'SELECT id FROM services WHERE id_equip = $1',
            [id]
        );
        
        if (usedInServices) {
            return res.send({msg: 'Невозможно удалить Инвентарь, так как оно используется в услугах. Сначала удалите или измените связанные услуги.'});
        }
        
        // Удаляем Инвентарь
        await req.db.none(
            'DELETE FROM equipments WHERE id = $1',
            [id]
        );
        
        console.log('Equipment deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении инвентаря: ' + error.message});
    }
});

module.exports = router;