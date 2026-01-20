var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_docs = user && user.id_role ? true : false

    let docs = await req.db.any(`
        SELECT
            docs.id AS id,
            docs.id_order AS id_order,
            docs.type_doc AS type_doc,
            docs.creationDate AS creationDate,
            docs.filePath AS filePath
        FROM
            docs
    `)
    console.log(docs)
    res.render('docs/list', { title: 'Документы', docs: docs, can_view_docs: can_view_docs })

});

router.post('/create', async function(req, res, next) {
    let doc = req.body;
    
    // Валидация
    if (!doc.id_order || !doc.type_doc || !doc.creationDate) {
        return res.send({msg: 'Обязательные поля: ID заказа, тип документа и дата создания'});
    }

    try {
        await req.db.none(
            'INSERT INTO docs(id_order, type_doc, creationDate, filePath) VALUES(${id_order}, ${type_doc}, ${creationDate}, ${filePath})', 
            doc
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании документа: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid doc ID');

    var user = session.auth(req).user
    var can_view_docs = user && user.id_role ? true : false

    try {
        // Получаем данные документа
        let doc = await req.db.one(`
            SELECT
                docs.id AS id,
                docs.id_order AS id_order,
                docs.type_doc AS type_doc,
                docs.creationDate AS creationDate,
                docs.filePath AS filePath
            FROM
                docs
            WHERE
                docs.id = ${id}
        `)

        // В зависимости от типа документа получаем дополнительные данные
        let additionalData = null;
        if (doc.type_doc === 'Заказ-наряд') {
            additionalData = await req.db.oneOrNone(`
                SELECT
                    docs_wo.id AS wo_id,
                    docs_wo.id_team AS id_team,
                    docs_wo.id_transport AS id_transport,
                    docs_wo.clientSign AS clientSign,
                    docs_wo.employeeSign AS employeeSign
                FROM
                    docs_wo
                WHERE
                    docs_wo.id_doc = ${id}
            `)
            
            // Получаем информацию о бригаде
            if (additionalData && additionalData.id_team) {
                let teamInfo = await req.db.oneOrNone(`
                    SELECT
                        teams.id_taskmaster AS team_leader_id
                    FROM
                        teams
                    WHERE
                        teams.id = ${additionalData.id_team}
                `)
                if (teamInfo) {
                    additionalData.team_leader_id = teamInfo.team_leader_id;
                }
            }
            
            // Получаем информацию о транспорте
            if (additionalData && additionalData.id_transport) {
                let transportInfo = await req.db.oneOrNone(`
                    SELECT
                        transports.model AS model,
                        transports.license_plate AS license_plate
                    FROM
                        transports
                    WHERE
                        transports.id = ${additionalData.id_transport}
                `)
                if (transportInfo) {
                    additionalData.transport_info = transportInfo;
                }
            }
            
        } else if (doc.type_doc === 'Акт об оказании услуг') {
            additionalData = await req.db.oneOrNone(`
                SELECT
                    docs_aors.id AS aors_id,
                    docs_aors.comments_d AS comments_d,
                    docs_aors.clientSign AS clientSign,
                    docs_aors.employeeSign AS employeeSign
                FROM
                    docs_aors
                WHERE
                    docs_aors.id_doc = ${id}
            `)
        }

        // Получаем информацию о заказе
        let orderInfo = null;
        if (doc.id_order) {
            orderInfo = await req.db.oneOrNone(`
                SELECT
                    orders.order_date AS order_date,
                    orders.address AS address
                FROM
                    orders
                WHERE
                    orders.id = ${doc.id_order}
            `)
        }

        res.render('docs/view', { 
            title: 'Документ: ' + doc.type_doc, 
            doc: doc, 
            additionalData: additionalData,
            orderInfo: orderInfo,
            can_view_docs: can_view_docs 
        })

    } catch (error) {
        console.error('Error fetching doc details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }

});

// Роут для обновления документа
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let doc = req.body;
    
    console.log('Update request for doc ID:', id);
    console.log('Data received:', doc);

    // Валидация
    if (!doc.id_order || !doc.type_doc || !doc.creationDate) {
        return res.send({msg: 'Обязательные поля: ID заказа, тип документа и дата создания'});
    }

    try {
        // Используйте параметризованный запрос
        await req.db.none(`
            UPDATE docs 
            SET 
                id_order = $1,
                type_doc = $2,
                creationDate = $3,
                filePath = $4
            WHERE id = $5
        `, [
            doc.id_order,
            doc.type_doc,
            doc.creationDate,
            doc.filePath || null,
            id
        ]);
        
        console.log('Doc updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении документа: ' + error.message});
    }
});

// Роут для удаления документа
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for doc ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID документа'});
    }
    
    try {
        // Проверяем, существует ли документ
        const docExists = await req.db.oneOrNone(
            'SELECT id FROM docs WHERE id = $1',
            [id]
        );
        
        if (!docExists) {
            return res.send({msg: 'Документ не найден'});
        }
        
        // Проверяем тип документа и удаляем из соответствующей таблицы
        const docType = await req.db.oneOrNone(
            'SELECT type_doc FROM docs WHERE id = $1',
            [id]
        );
        
        if (docType && docType.type_doc === 'Заказ-наряд') {
            await req.db.none(
                'DELETE FROM docs_wo WHERE id_doc = $1',
                [id]
            );
        } else if (docType && docType.type_doc === 'Акт об оказании услуг') {
            await req.db.none(
                'DELETE FROM docs_aors WHERE id_doc = $1',
                [id]
            );
        }
        
        // Удаляем основной документ
        await req.db.none(
            'DELETE FROM docs WHERE id = $1',
            [id]
        );
        
        console.log('Doc deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении документа: ' + error.message});
    }
});

module.exports = router;