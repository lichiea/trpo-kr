var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user
    var can_view_services = user && user.id_role ? true : false

    let services = await req.db.any(`
        SELECT
            services.id AS id,
            services.label AS label,
            services.description AS description,
            services.id_equip AS id_equip,
            equipments.label AS equip_name
        FROM
            services
        LEFT JOIN equipments ON services.id_equip = equipments.id
    `)
    console.log(services)
    
    // Получаем список оборудования для выпадающего списка
    let equipments = await req.db.any(`
        SELECT
            id,
            label
        FROM
            equipments
        ORDER BY label
    `)
    
    res.render('services/list', { 
        title: 'Услуги', 
        services: services, 
        equipments: equipments,
        can_view_services: can_view_services 
    })
});

router.post('/create', async function(req, res, next) {
    let service = req.body;
    
    // Валидация
    if (!service.label) {
        return res.send({msg: 'Название услуги обязательно'});
    }

    try {
        await req.db.none(
            'INSERT INTO services(label, description, id_equip) VALUES(${label}, ${description}, ${id_equip})', 
            service
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании услуги: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid service ID');

    var user = session.auth(req).user
    var can_view_services = user && user.id_role ? true : false

    try {
        // Получаем данные услуги
        let service = await req.db.one(`
            SELECT
                services.id AS id,
                services.label AS label,
                services.description AS description,
                services.id_equip AS id_equip
            FROM
                services
            WHERE
                services.id = ${id}
        `)

        // Получаем информацию об оборудовании
        let equipmentInfo = null;
        if (service.id_equip) {
            equipmentInfo = await req.db.oneOrNone(`
                SELECT
                    equipments.id AS equip_id,
                    equipments.label AS equip_label,
                    equipments.description AS equip_description
                FROM
                    equipments
                WHERE
                    equipments.id = ${service.id_equip}
            `)
        }

        // Получаем список оборудования для выпадающего списка
        let equipments = await req.db.any(`
            SELECT
                id,
                label
            FROM
                equipments
            ORDER BY label
        `)

        // Получаем активный прейскурант
        let activePricelist = await req.db.oneOrNone(`
            SELECT
                id,
                label,
                validFrom,
                validTo
            FROM
                pricelists
            WHERE
                isActive = TRUE
            LIMIT 1
        `)

        // Получаем цену услуги в активном прейскуранте
        let currentPrice = null;
        if (activePricelist) {
            currentPrice = await req.db.oneOrNone(`
                SELECT
                    price
                FROM
                    pricelists_items
                WHERE
                    id_serv = ${id} AND id_pricelist = ${activePricelist.id}
            `)
        }

        // Получаем историю цен в других прейскурантах
        let priceHistory = await req.db.any(`
            SELECT
                pl.id AS pricelist_id,
                pl.label AS pricelist_label,
                pl.validFrom,
                pl.validTo,
                pl.isActive,
                pi.price,
                pi.id AS price_item_id
            FROM
                pricelists pl
            LEFT JOIN pricelists_items pi ON pl.id = pi.id_pricelist AND pi.id_serv = ${id}
            ORDER BY pl.validFrom DESC
        `)

        // Форматируем даты
        if (activePricelist) {
            activePricelist.validFromFormatted = formatDate(activePricelist.validFrom);
            activePricelist.validToFormatted = formatDate(activePricelist.validTo);
        }

        priceHistory.forEach(item => {
            item.validFromFormatted = formatDate(item.validFrom);
            item.validToFormatted = formatDate(item.validTo);
        });

        res.render('services/view', { 
            title: 'Услуга: ' + service.label, 
            service: service, 
            equipmentInfo: equipmentInfo,
            equipments: equipments,
            activePricelist: activePricelist,
            currentPrice: currentPrice,
            priceHistory: priceHistory,
            can_view_services: can_view_services 
        })

    } catch (error) {
        console.error('Error fetching service details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для обновления услуги
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let service = req.body;
    
    console.log('Update request for service ID:', id);
    console.log('Data received:', service);

    // Валидация
    if (!service.label) {
        return res.send({msg: 'Название услуги обязательно'});
    }

    try {
        // Используйте параметризованный запрос
        await req.db.none(`
            UPDATE services 
            SET 
                label = $1,
                description = $2,
                id_equip = $3
            WHERE id = $4
        `, [
            service.label,
            service.description || null,
            service.id_equip || null,
            id
        ]);
        
        console.log('Service updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении услуги: ' + error.message});
    }
});

// Роут для удаления услуги
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for service ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID услуги'});
    }
    
    try {
        // Проверяем, существует ли услуга
        const serviceExists = await req.db.oneOrNone(
            'SELECT id FROM services WHERE id = $1',
            [id]
        );
        
        if (!serviceExists) {
            return res.send({msg: 'Услуга не найдена'});
        }
        
        // Проверяем, не используется ли услуга в других таблицах
        const hasReferences = await req.db.oneOrNone(
            'SELECT id_service FROM orders WHERE id_service = $1 LIMIT 1',
            [id]
        );
        
        if (hasReferences) {
            return res.send({msg: 'Невозможно удалить услугу, так как она используется в заказах'});
        }
        
        // Удаляем услугу
        await req.db.none(
            'DELETE FROM services WHERE id = $1',
            [id]
        );
        
        console.log('Service deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении услуги: ' + error.message});
    }
});

// Вспомогательная функция для форматирования даты
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

module.exports = router;