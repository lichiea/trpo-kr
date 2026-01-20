var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user;
    var can_view_pricelists = user && user.id_role ? true : false;

    let pricelists = await req.db.any(`
        SELECT
            pricelists.id AS id,
            pricelists.label AS label,
            pricelists.validFrom AS validFrom,
            pricelists.validTo AS validTo,
            pricelists.isActive AS isActive
        FROM
            pricelists
        ORDER BY pricelists.id DESC
    `);
    
    console.log(pricelists);
    res.render('pricelists/list', { 
        title: 'Прейскуранты', 
        pricelists: pricelists, 
        can_view_pricelists: can_view_pricelists 
    });
});

router.post('/create', async function(req, res, next) {
    let pricelist = req.body;
    
    // Валидация
    if (!pricelist.label || !pricelist.validFrom) {
        return res.send({msg: 'Обязательные поля: Название и дата начала действия'});
    }

    try {
        await req.db.none(
            'INSERT INTO pricelists(label, validFrom, validTo, isActive) VALUES(${label}, ${validFrom}, ${validTo}, ${isActive})', 
            pricelist
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании прейскуранта: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid pricelist ID');

    var user = session.auth(req).user;
    var can_view_pricelists = user && user.id_role ? true : false;

    try {
        // Получаем данные прейскуранта
        let pricelist = await req.db.oneOrNone(`
            SELECT
                pricelists.id AS id,
                pricelists.label AS label,
                pricelists.validFrom AS validFrom,
                pricelists.validTo AS validTo,
                pricelists.isActive AS isActive
            FROM
                pricelists
            WHERE
                pricelists.id = ${id}
        `);

        // Если прейскурант не найден
        if (!pricelist) {
            return res.status(404).send('Прейскурант не найден');
        }

        // Получаем позиции прейскуранта
        let pricelistItems = await req.db.any(`
            SELECT
                pricelists_items.id AS id,
                pricelists_items.id_serv AS service_id,
                services.label AS service_label,  -- Исправлено: было services.name, стало services.label
                services.description AS service_description,
                services.id_equip AS equipment_id,
                pricelists_items.price AS price
            FROM
                pricelists_items
            LEFT JOIN services ON pricelists_items.id_serv = services.id
            WHERE
                pricelists_items.id_pricelist = ${id}
            ORDER BY services.label
        `);

        // Получаем список всех услуг для добавления новых позиций
        let allServices = await req.db.any(`
            SELECT
                services.id AS id,
                services.label AS label,
                services.description AS description
            FROM
                services
            ORDER BY services.label
        `);

        res.render('pricelists/view', { 
            title: 'Прейскурант: ' + pricelist.label, 
            pricelist: pricelist, 
            pricelistItems: pricelistItems,
            allServices: allServices,
            can_view_pricelists: can_view_pricelists 
        });

    } catch (error) {
        console.error('Error fetching pricelist details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для добавления позиции в прейскурант
router.post('/:id/add-item', async function(req, res) {
    let pricelistId = parseInt(req.params.id);
    let itemData = req.body;
    
    if (isNaN(pricelistId) || !itemData.service_id || !itemData.price) {
        return res.send({msg: 'Неверные данные: требуется ID услуги и цена'});
    }

    try {
        // Проверяем, существует ли уже такая услуга в прейскуранте
        const existingItem = await req.db.oneOrNone(`
            SELECT id FROM pricelists_items 
            WHERE id_pricelist = $1 AND id_serv = $2
        `, [pricelistId, itemData.service_id]);
        
        if (existingItem) {
            return res.send({msg: 'Эта услуга уже добавлена в прейскурант'});
        }

        // Добавляем позицию
        await req.db.none(
            'INSERT INTO pricelists_items(id_pricelist, id_serv, price) VALUES($1, $2, $3)',
            [pricelistId, itemData.service_id, itemData.price]
        );
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Add item error:', error);
        res.send({msg: 'Ошибка при добавлении позиции: ' + error.message});
    }
});

// Роут для удаления позиции из прейскуранта
router.delete('/item/:id', async function(req, res) {
    let itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
        return res.send({msg: 'Неверный ID позиции'});
    }
    
    try {
        await req.db.none(
            'DELETE FROM pricelists_items WHERE id = $1',
            [itemId]
        );
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete item error:', error);
        res.send({msg: 'Ошибка при удалении позиции: ' + error.message});
    }
});

router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let pricelist = req.body;
    
    console.log('Update request for pricelist ID:', id);
    console.log('Data received:', pricelist);

    // Валидация
    if (!pricelist.label || !pricelist.validFrom) {
        return res.send({msg: 'Обязательные поля: Название и дата начала действия'});
    }

    try {
        await req.db.none(`
            UPDATE pricelists 
            SET 
                label = $1,
                validFrom = $2,
                validTo = $3,
                isActive = $4
            WHERE id = $5
        `, [
            pricelist.label,
            pricelist.validFrom,
            pricelist.validTo || null,
            pricelist.isActive || false,
            id
        ]);
        
        console.log('Pricelist updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении прейскуранта: ' + error.message});
    }
});

router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for pricelist ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID прейскуранта'});
    }
    
    try {
        // Проверяем, существует ли прейскурант
        const pricelistExists = await req.db.oneOrNone(
            'SELECT id FROM pricelists WHERE id = $1',
            [id]
        );
        
        if (!pricelistExists) {
            return res.send({msg: 'Прейскурант не найден'});
        }
        
        // Проверяем, есть ли связанные позиции
        const hasItems = await req.db.oneOrNone(
            'SELECT id FROM pricelists_items WHERE id_pricelist = $1 LIMIT 1',
            [id]
        );
        
        if (hasItems) {
            return res.send({msg: 'Невозможно удалить прейскурант, так как в нем есть позиции. Сначала удалите все позиции.'});
        }
        
        // Удаляем прейскурант
        await req.db.none(
            'DELETE FROM pricelists WHERE id = $1',
            [id]
        );
        
        console.log('Pricelist deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении прейскуранта: ' + error.message});
    }
});

module.exports = router;