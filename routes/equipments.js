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
    `)
    console.log(equipments)
    res.render('equipments/list', { title: 'Оборудование', equipments: equipments, can_view_equipments: can_view_equipments })
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
        res.send({msg: 'Ошибка при создании оборудования: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid equipment ID');

    var user = session.auth(req).user
    var can_view_equipments = user && user.id_role ? true : false

    try {
        // Получаем данные оборудования
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

        res.render('equipments/view', { 
            title: 'Оборудование: ' + equipment.label, 
            equipment: equipment, 
            can_view_equipments: can_view_equipments 
        })

    } catch (error) {
        console.error('Error fetching equipment details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для обновления оборудования
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
        res.send({msg: 'Ошибка при обновлении оборудования: ' + error.message});
    }
});

// Роут для удаления оборудования
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for equipment ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID оборудования'});
    }
    
    try {
        // Проверяем, существует ли оборудование
        const equipmentExists = await req.db.oneOrNone(
            'SELECT id FROM equipments WHERE id = $1',
            [id]
        );
        
        if (!equipmentExists) {
            return res.send({msg: 'Оборудование не найдено'});
        }
        
        // Удаляем оборудование
        await req.db.none(
            'DELETE FROM equipments WHERE id = $1',
            [id]
        );
        
        console.log('Equipment deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении оборудования: ' + error.message});
    }
});

module.exports = router;