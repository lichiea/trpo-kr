var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user
    var can_view_orders = user && user.id_role ? true : false

    // Получаем параметры фильтрации из запроса
    const status = req.query.status;
    const client_fio = req.query.client_fio;
    
    // Формируем условия фильтрации
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (status && status !== 'all') {
        whereConditions.push(`orders.id_status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
    }
    
    if (client_fio) {
        whereConditions.push(`clients.fio ILIKE $${paramIndex}`);
        queryParams.push(`%${client_fio}%`);
        paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ') 
        : '';
    
    // Получаем заказы с фильтрацией
    let query = `
        SELECT
            orders.id AS id,
            orders.id_status AS status,
            orders.creationdate AS creationdate,
            orders.id_client AS id_client,
            orders.totalcost AS totalcost,
            orders.planneddate AS planneddate,
            orders.description AS description,
            orders.id_clean_object AS id_clean_object,
            clients.fio AS client_fio,
            clean_objects.squaremeterage AS object_square
        FROM
            orders
        LEFT JOIN clients ON orders.id_client = clients.id
        LEFT JOIN clean_objects ON orders.id_clean_object = clean_objects.id
        ${whereClause}
        ORDER BY orders.creationdate DESC, orders.id DESC
    `;
    
    let orders;
    if (queryParams.length > 0) {
        orders = await req.db.any(query, queryParams);
    } else {
        orders = await req.db.any(query);
    }
    
    // Получаем все статусы для фильтра
    let statuses = await req.db.any(`
        SELECT unnest(enum_range(NULL::order_statuses)) AS status
    `);
    
    res.render('orders/list', { 
        title: 'Заказы', 
        orders: orders, 
        can_view_orders: can_view_orders,
        statuses: statuses,
        currentFilters: {
            status: status || 'all',
            client_fio: client_fio || ''
        }
    })
});

// Получение площади объекта уборки
router.get('/objects/:id/square', async function(req, res) {
    try {
        const objectId = parseInt(req.params.id);
        const object = await req.db.oneOrNone(`
            SELECT squaremeterage FROM clean_objects WHERE id = $1
        `, [objectId]);
        
        if (object && object.squaremeterage) {
            res.json({ square: object.squaremeterage });
        } else {
            res.json({ square: 0 });
        }
    } catch (error) {
        console.error('Error fetching object square:', error);
        res.json({ square: 0 });
    }
});

// Создание заказа с услугами (с правильным расчетом стоимости)
router.post('/create', async function(req, res) {
    try {
        const { order, services, objectSquare } = req.body;
        
        // Валидация
        if (!order.id_client) {
            return res.json({success: false, error: 'Выберите клиента'});
        }
        
        if (!services || services.length === 0) {
            return res.json({success: false, error: 'Добавьте хотя бы одну услугу'});
        }
        
        // Рассчитываем общую стоимость: площадь * сумма стоимостей услуг
        let servicesTotal = 0;
        services.forEach(service => {
            servicesTotal += parseInt(service.price) || 0;
        });
        
        let totalCost = 0;
        if (objectSquare && objectSquare > 0) {
            totalCost = servicesTotal * parseInt(objectSquare);
        } else {
            // Если площадь не указана, используем сумму стоимостей
            totalCost = servicesTotal;
        }
        
        // Преобразуем даты
        const creationDate = order.creationDate ? new Date(order.creationDate) : new Date();
        const plannedDate = order.plannedDate ? new Date(order.plannedDate) : null;
        
        // Используем транзакцию
        const newOrder = await req.db.tx(async t => {
            // Создаем заказ
            const orderResult = await t.one(`
                INSERT INTO orders (
                    id_status, 
                    creationdate, 
                    id_client, 
                    totalcost, 
                    planneddate, 
                    description,
                    id_clean_object
                ) VALUES (
                    $1::order_statuses,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                ) RETURNING id
            `, [
                order.id_status || 'Новый',
                creationDate,
                parseInt(order.id_client),
                totalCost,
                plannedDate,
                order.description || null,
                order.id_clean_object ? parseInt(order.id_clean_object) : null
            ]);
            
            // Добавляем услуги в заказ (с ценами)
            for (const service of services) {
                await t.none(`
                    INSERT INTO orders_items (id_order, id_serv, price)
                    VALUES ($1, $2, $3)
                `, [orderResult.id, parseInt(service.id), parseInt(service.price)]);
            }
            
            return orderResult;
        });
        
        res.json({ success: true, orderId: newOrder.id });
        
    } catch (error) {
        console.error('Error creating order:', error);
        if (error.message.includes('столбец "price"')) {
            return res.json({ 
                success: false, 
                error: 'Ошибка структуры базы данных. Необходимо добавить колонку "price" в таблицу "orders_items"' 
            });
        }
        res.status(500).json({ success: false, error: 'Ошибка создания заказа: ' + error.message });
    }
});

// Просмотр деталей заказа с документами
router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Неверный ID заказа');

    var user = session.auth(req).user
    var can_view_orders = user && user.id_role ? true : false

    try {
        // Получаем данные заказа
        let order = await req.db.oneOrNone(`
            SELECT
                orders.id AS id,
                orders.id_status AS status,
                orders.creationdate AS creationdate,
                orders.id_client AS id_client,
                orders.totalcost AS totalcost,
                orders.planneddate AS planneddate,
                orders.description AS description,
                orders.id_clean_object AS id_clean_object,
                clients.fio AS client_fio,
                clients.phone AS client_phone,
                clients.email AS client_email,
                clients.type_l AS client_type,
                clean_objects.address AS object_address,
                clean_objects.type_co AS object_type,
                clean_objects.squaremeterage AS object_square,
                clean_objects.description AS object_description
            FROM orders
            LEFT JOIN clients ON orders.id_client = clients.id
            LEFT JOIN clean_objects ON orders.id_clean_object = clean_objects.id
            WHERE orders.id = ${id}
        `)

        if (!order) return res.status(404).send('Заказ не найден');

        // Получаем услуги в заказе
        let orderItems = await req.db.any(`
            SELECT
                orders_items.id AS item_id,
                orders_items.price AS item_price,
                services.label AS service_label,
                services.description AS service_description
            FROM orders_items
            LEFT JOIN services ON orders_items.id_serv = services.id
            WHERE orders_items.id_order = ${id}
        `)

        // Получаем документы заказа
        let docs = await req.db.any(`
            SELECT
                docs.id AS doc_id,
                docs.type_doc AS doc_type,
                docs.creationdate AS doc_creationdate,
                docs.filepath AS doc_filepath
            FROM docs
            WHERE docs.id_order = ${id}
            ORDER BY docs.creationdate DESC
        `)

        // Получаем документы "Заказ-наряд" с дополнительной информацией
        let workOrders = [];
        for (let doc of docs.filter(d => d.doc_type === 'Заказ-наряд')) {
            let workOrder = await req.db.oneOrNone(`
                SELECT
                    docs_wo.id AS id,
                    docs_wo.id_team AS id_team,
                    docs_wo.id_transport AS id_transport,
                    docs_wo.clientsign AS client_sign,
                    docs_wo.employeesign AS employee_sign,
                    teams.id_taskmaster AS team_leader_id,
                    transports.model AS transport_model,
                    transports.registrationnumber AS transport_plate
                FROM docs_wo
                LEFT JOIN teams ON docs_wo.id_team = teams.id
                LEFT JOIN transports ON docs_wo.id_transport = transports.id
                WHERE docs_wo.id_doc = ${doc.doc_id}
            `);
            
            if (workOrder) {
                // Получаем информацию о бригадире
                if (workOrder.team_leader_id) {
                    let teamLeader = await req.db.oneOrNone(`
                        SELECT fio, position_d FROM employees WHERE id = ${workOrder.team_leader_id}
                    `);
                    workOrder.team_leader = teamLeader;
                }
                
                // Получаем состав бригады
                let teamMembers = await req.db.any(`
                    SELECT 
                        employees.id AS id,
                        employees.fio AS fio,
                        employees.position_d AS position
                    FROM team_items
                    JOIN employees ON team_items.id_employee = employees.id
                    WHERE team_items.id_team = ${workOrder.id_team}
                `);
                workOrder.team_members = teamMembers;
                
                workOrders.push({
                    doc: doc,
                    details: workOrder
                });
            }
        }

        // Получаем документы "Акт об оказании услуг" с дополнительной информацией
        let serviceActs = [];
        for (let doc of docs.filter(d => d.doc_type === 'Акт об оказании услуг')) {
            let serviceAct = await req.db.oneOrNone(`
                SELECT
                    docs_aors.id AS id,
                    docs_aors.comments_d AS comments,
                    docs_aors.clientsign AS client_sign,
                    docs_aors.employeesign AS employee_sign
                FROM docs_aors
                WHERE docs_aors.id_doc = ${doc.doc_id}
            `);
            
            if (serviceAct) {
                serviceActs.push({
                    doc: doc,
                    details: serviceAct
                });
            }
        }

        // Получаем список всех бригад для формирования документов
        let teams = await req.db.any(`
            SELECT 
                teams.id AS id,
                employees.fio AS leader_fio,
                employees.position_d AS leader_position
            FROM teams
            LEFT JOIN employees ON teams.id_taskmaster = employees.id
            ORDER BY teams.id
        `)

        // Получаем список всех транспортных средств (исправлено: model вместо name)
        let transports = await req.db.any(`
            SELECT 
                id,
                model,
                registrationnumber
            FROM transports
            ORDER BY model
        `)

        // Получаем список всех статусов
        let statuses = await req.db.any(`SELECT unnest(enum_range(NULL::order_statuses)) AS status`)

        // Форматируем даты для отображения
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU');
        };

        res.render('orders/view', { 
            title: 'Заказ #' + order.id, 
            order: order,
            orderItems: orderItems,
            workOrders: workOrders,
            serviceActs: serviceActs,
            teams: teams,
            transports: transports,
            statuses: statuses,
            formatDate: formatDate,
            can_view_orders: can_view_orders 
        })

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для создания документа "Заказ-наряд"
router.post('/:id/documents/work-order', async function(req, res) {
    try {
        const orderId = parseInt(req.params.id);
        const { team_id, transport_id, creation_date } = req.body;
        
        // Проверяем существование заказа
        const orderExists = await req.db.oneOrNone('SELECT id FROM orders WHERE id = $1', [orderId]);
        if (!orderExists) {
            return res.json({ success: false, error: 'Заказ не найден' });
        }
        
        // Создаем документ
        const doc = await req.db.tx(async t => {
            // Создаем запись в docs
            const newDoc = await t.one(`
                INSERT INTO docs (id_order, type_doc, creationdate, filepath)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [
                orderId,
                'Заказ-наряд',
                creation_date || new Date(),
                `/documents/work-order-${orderId}-${Date.now()}.pdf`
            ]);
            
            // Создаем запись в docs_wo
            await t.none(`
                INSERT INTO docs_wo (id_doc, id_team, id_transport, clientsign, employeesign)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                newDoc.id,
                parseInt(team_id) || null,
                parseInt(transport_id) || null,
                false,
                false
            ]);
            
            return newDoc;
        });
        
        res.json({ 
            success: true, 
            docId: doc.id,
            message: 'Заказ-наряд успешно создан'
        });
        
    } catch (error) {
        console.error('Error creating work order:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания документа: ' + error.message });
    }
});

// Роут для создания документа "Акт об оказании услуг"
router.post('/:id/documents/service-act', async function(req, res) {
    try {
        const orderId = parseInt(req.params.id);
        const { comments, creation_date } = req.body;
        
        // Проверяем существование заказа
        const orderExists = await req.db.oneOrNone('SELECT id FROM orders WHERE id = $1', [orderId]);
        if (!orderExists) {
            return res.json({ success: false, error: 'Заказ не найден' });
        }
        
        // Создаем документ
        const doc = await req.db.tx(async t => {
            // Создаем запись в docs
            const newDoc = await t.one(`
                INSERT INTO docs (id_order, type_doc, creationdate, filepath)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [
                orderId,
                'Акт об оказании услуг',
                creation_date || new Date(),
                `/documents/service-act-${orderId}-${Date.now()}.pdf`
            ]);
            
            // Создаем запись в docs_aors
            await t.none(`
                INSERT INTO docs_aors (id_doc, comments_d, clientsign, employeesign)
                VALUES ($1, $2, $3, $4)
            `, [
                newDoc.id,
                comments || '',
                false,
                false
            ]);
            
            return newDoc;
        });
        
        res.json({ 
            success: true, 
            docId: doc.id,
            message: 'Акт об оказании услуг успешно создан'
        });
        
    } catch (error) {
        console.error('Error creating service act:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания документа: ' + error.message });
    }
});

// Роут для подписания документа клиентом
router.post('/documents/:docId/sign/client', async function(req, res) {
    try {
        const docId = parseInt(req.params.docId);
        
        // Обновляем подпись клиента
        await req.db.tx(async t => {
            // Проверяем тип документа
            const doc = await t.oneOrNone('SELECT type_doc FROM docs WHERE id = $1', [docId]);
            
            if (!doc) {
                throw new Error('Документ не найден');
            }
            
            if (doc.type_doc === 'Заказ-наряд') {
                await t.none('UPDATE docs_wo SET clientsign = true WHERE id_doc = $1', [docId]);
            } else if (doc.type_doc === 'Акт об оказании услуг') {
                await t.none('UPDATE docs_aors SET clientsign = true WHERE id_doc = $1', [docId]);
            }
        });
        
        res.json({ success: true, message: 'Документ подписан клиентом' });
        
    } catch (error) {
        console.error('Error signing document:', error);
        res.status(500).json({ success: false, error: 'Ошибка подписания документа' });
    }
});

// Роут для подписания документа сотрудником
router.post('/documents/:docId/sign/employee', async function(req, res) {
    try {
        const docId = parseInt(req.params.docId);
        
        // Обновляем подпись сотрудника
        await req.db.tx(async t => {
            // Проверяем тип документа
            const doc = await t.oneOrNone('SELECT type_doc FROM docs WHERE id = $1', [docId]);
            
            if (!doc) {
                throw new Error('Документ не найден');
            }
            
            if (doc.type_doc === 'Заказ-наряд') {
                await t.none('UPDATE docs_wo SET employeesign = true WHERE id_doc = $1', [docId]);
            } else if (doc.type_doc === 'Акт об оказании услуг') {
                await t.none('UPDATE docs_aors SET employeesign = true WHERE id_doc = $1', [docId]);
            }
        });
        
        res.json({ success: true, message: 'Документ подписан сотрудником' });
        
    } catch (error) {
        console.error('Error signing document:', error);
        res.status(500).json({ success: false, error: 'Ошибка подписания документа' });
    }
});

// Роут для просмотра документа (заказ-наряд)
router.get('/:orderId/documents/:docId/view', async function(req, res) {
    try {
        const orderId = parseInt(req.params.orderId);
        const docId = parseInt(req.params.docId);
        
        // Получаем данные заказа
        const order = await req.db.oneOrNone(`
            SELECT orders.*, clients.fio AS client_fio, clients.phone AS client_phone,
                   clean_objects.address AS object_address, clean_objects.squaremeterage
            FROM orders
            LEFT JOIN clients ON orders.id_client = clients.id
            LEFT JOIN clean_objects ON orders.id_clean_object = clean_objects.id
            WHERE orders.id = $1
        `, [orderId]);
        
        if (!order) {
            return res.status(404).send('Заказ не найден');
        }
        
        // Получаем данные документа
        const doc = await req.db.oneOrNone(`
            SELECT docs.*, docs_wo.*, docs_aors.*, teams.id_taskmaster,
                   transports.model AS transport_model, transports.registrationnumber
            FROM docs
            LEFT JOIN docs_wo ON docs.id = docs_wo.id_doc
            LEFT JOIN docs_aors ON docs.id = docs_aors.id_doc
            LEFT JOIN teams ON docs_wo.id_team = teams.id
            LEFT JOIN transports ON docs_wo.id_transport = transports.id
            WHERE docs.id = $1
        `, [docId]);
        
        if (!doc) {
            return res.status(404).send('Документ не найден');
        }
        
        // Получаем услуги заказа
        const services = await req.db.any(`
            SELECT services.label, services.description, orders_items.price
            FROM orders_items
            JOIN services ON orders_items.id_serv = services.id
            WHERE orders_items.id_order = $1
        `, [orderId]);
        
        // Получаем информацию о бригадире
        let teamLeader = null;
        if (doc.id_taskmaster) {
            teamLeader = await req.db.oneOrNone(`
                SELECT fio, position_d FROM employees WHERE id = $1
            `, [doc.id_taskmaster]);
        }
        
        // Получаем состав бригады
        let teamMembers = [];
        if (doc.id_team) {
            teamMembers = await req.db.any(`
                SELECT employees.fio, employees.position_d
                FROM team_items
                JOIN employees ON team_items.id_employee = employees.id
                WHERE team_items.id_team = $1
            `, [doc.id_team]);
        }
        
        // Рассчитываем общую стоимость
        const servicesTotal = services.reduce((sum, service) => sum + (service.price || 0), 0);
        const totalCost = order.squaremeterage ? servicesTotal * order.squaremeterage : servicesTotal;
        
        // Формируем HTML в зависимости от типа документа
        let htmlContent = '';
        
        if (doc.type_doc === 'Заказ-наряд') {
            htmlContent = `
                <!DOCTYPE html>
                <html lang="ru">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Заказ-наряд №${docId}</title>
                    <style>
                        body {
                            font-family: 'Times New Roman', Times, serif;
                            line-height: 1.5;
                            color: #000;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .header h1 {
                            font-size: 18px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                        }
                        .header .document-number {
                            font-size: 14px;
                            margin-bottom: 20px;
                        }
                        .company-info {
                            text-align: center;
                            margin-bottom: 30px;
                            font-size: 12px;
                        }
                        .section {
                            margin-bottom: 20px;
                        }
                        .section-title {
                            font-weight: bold;
                            text-align: center;
                            border-bottom: 1px solid #000;
                            padding-bottom: 5px;
                            margin-bottom: 15px;
                        }
                        .info-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 15px;
                            font-size: 12px;
                        }
                        .info-table td {
                            padding: 8px;
                            border: 1px solid #000;
                            vertical-align: top;
                        }
                        .info-table .label {
                            font-weight: bold;
                            width: 30%;
                            background-color: #f5f5f5;
                        }
                        .services-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                            font-size: 12px;
                        }
                        .services-table th,
                        .services-table td {
                            padding: 8px;
                            border: 1px solid #000;
                            text-align: center;
                        }
                        .services-table th {
                            font-weight: bold;
                            background-color: #f5f5f5;
                        }
                        .signatures {
                            margin-top: 50px;
                            display: flex;
                            justify-content: space-between;
                        }
                        .signature-block {
                            width: 45%;
                            text-align: center;
                        }
                        .signature-line {
                            border-top: 1px solid #000;
                            margin: 50px 0 5px 0;
                        }
                        .signature-name {
                            font-size: 12px;
                        }
                        .stamp-place {
                            height: 100px;
                            border: 1px dashed #999;
                            margin-top: 20px;
                            text-align: center;
                            line-height: 100px;
                            color: #999;
                        }
                        .footer {
                            margin-top: 30px;
                            font-size: 10px;
                            text-align: center;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Заказ-наряд №${docId}</h1>
                        <div class="document-number">от ${new Date(doc.creationdate).toLocaleDateString('ru-RU')}</div>
                    </div>
                    
                    <div class="company-info">
                        <strong>Клининговая компания "Чистота"</strong><br>
                        ИНН 1234567890, ОГРН 1234567890123<br>
                        г. Москва, ул. Чистая, д. 1<br>
                        Тел.: +7 (495) 123-45-67
                    </div>
                    
                    <div class="section">
                        <div class="section-title">1. ИНФОРМАЦИЯ О ЗАКАЗЕ</div>
                        <table class="info-table">
                            <tr>
                                <td class="label">Номер заказа:</td>
                                <td>${order.id}</td>
                            </tr>
                            <tr>
                                <td class="label">Клиент:</td>
                                <td>${order.client_fio || 'Не указан'}</td>
                            </tr>
                            <tr>
                                <td class="label">Телефон:</td>
                                <td>${order.client_phone || 'Не указан'}</td>
                            </tr>
                            <tr>
                                <td class="label">Адрес объекта:</td>
                                <td>${order.object_address || 'Не указан'}</td>
                            </tr>
                            <tr>
                                <td class="label">Площадь объекта:</td>
                                <td>${order.squaremeterage ? order.squaremeterage + ' м²' : 'Не указана'}</td>
                            </tr>
                            <tr>
                                <td class="label">Плановая дата выполнения:</td>
                                <td>${order.planneddate ? new Date(order.planneddate).toLocaleDateString('ru-RU') : 'Не указана'}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">2. ПЕРЕЧЕНЬ УСЛУГ</div>
                        <table class="services-table">
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Наименование услуги</th>
                                    <th>Описание</th>
                                    <th>Стоимость за м²</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${services.map((service, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${service.label || 'Услуга'}</td>
                                        <td>${service.description || '-'}</td>
                                        <td>${service.price ? service.price.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">3. РАСЧЕТ СТОИМОСТИ</div>
                        <table class="info-table">
                            <tr>
                                <td class="label">Сумма стоимостей услуг (за м²):</td>
                                <td>${servicesTotal.toLocaleString('ru-RU')} ₽</td>
                            </tr>
                            <tr>
                                <td class="label">Площадь объекта:</td>
                                <td>${order.squaremeterage ? order.squaremeterage + ' м²' : 'Не указана'}</td>
                            </tr>
                            <tr>
                                <td class="label">Общая стоимость работ:</td>
                                <td><strong>${totalCost.toLocaleString('ru-RU')} ₽</strong></td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">4. НАЗНАЧЕНИЕ БРИГАДЫ И ТРАНСПОРТА</div>
                        <table class="info-table">
                            <tr>
                                <td class="label">Бригада:</td>
                                <td>
                                    ${doc.id_team ? `Бригада №${doc.id_team}` : 'Не назначена'}
                                    ${teamLeader ? `<br>Бригадир: ${teamLeader.fio} (${teamLeader.position_d})` : ''}
                                </td>
                            </tr>
                            ${teamMembers.length > 0 ? `
                                <tr>
                                    <td class="label">Состав бригады:</td>
                                    <td>
                                        ${teamMembers.map(member => `${member.fio} - ${member.position_d}`).join('<br>')}
                                    </td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td class="label">Транспорт:</td>
                                <td>
                                    ${doc.id_transport && doc.transport_model ? 
                                        `${doc.transport_model} (${doc.registrationnumber || 'без номера'})` : 
                                        'Не назначен'}
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">5. ОСОБЫЕ УСЛОВИЯ</div>
                        <p>1. Исполнитель обязуется выполнить работы в соответствии с настоящим заказ-нарядом.</p>
                        <p>2. Клиент обязуется обеспечить доступ к объекту в согласованное время.</p>
                        <p>3. Все изменения условий работ оформляются дополнительным соглашением.</p>
                    </div>
                    
                    <div class="signatures">
                        <div class="signature-block">
                            <div><strong>Клиент:</strong></div>
                            <div>${order.client_fio || '________________'}</div>
                            <div class="signature-line"></div>
                            <div class="signature-name">подпись, расшифровка подписи</div>
                            <div class="stamp-place">М.П. (при наличии)</div>
                        </div>
                        
                        <div class="signature-block">
                            <div><strong>Исполнитель:</strong></div>
                            <div>Клининговая компания "Чистота"</div>
                            <div class="signature-line"></div>
                            <div class="signature-name">подпись, расшифровка подписи</div>
                            <div class="stamp-place">Печать организации</div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        Документ сгенерирован автоматически. Не требует ручного заполнения.
                    </div>
                </body>
                </html>
            `;
        } else if (doc.type_doc === 'Акт об оказании услуг') {
            htmlContent = `
                <!DOCTYPE html>
                <html lang="ru">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Акт об оказании услуг №${docId}</title>
                    <style>
                        body {
                            font-family: 'Times New Roman', Times, serif;
                            line-height: 1.5;
                            color: #000;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        .header h1 {
                            font-size: 18px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            text-transform: uppercase;
                        }
                        .header .document-number {
                            font-size: 14px;
                            margin-bottom: 20px;
                        }
                        .company-info {
                            text-align: center;
                            margin-bottom: 30px;
                            font-size: 12px;
                        }
                        .parties {
                            margin-bottom: 30px;
                        }
                        .parties h2 {
                            font-size: 14px;
                            font-weight: bold;
                            text-align: center;
                            margin-bottom: 15px;
                        }
                        .parties-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 12px;
                        }
                        .parties-table td {
                            padding: 8px;
                            border: 1px solid #000;
                            vertical-align: top;
                        }
                        .parties-table .label {
                            font-weight: bold;
                            width: 30%;
                            background-color: #f5f5f5;
                        }
                        .section {
                            margin-bottom: 20px;
                        }
                        .section-title {
                            font-weight: bold;
                            text-align: center;
                            border-bottom: 1px solid #000;
                            padding-bottom: 5px;
                            margin-bottom: 15px;
                        }
                        .services-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                            font-size: 12px;
                        }
                        .services-table th,
                        .services-table td {
                            padding: 8px;
                            border: 1px solid #000;
                            text-align: center;
                        }
                        .services-table th {
                            font-weight: bold;
                            background-color: #f5f5f5;
                        }
                        .cost-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                            font-size: 12px;
                        }
                        .cost-table td {
                            padding: 8px;
                            border: 1px solid #000;
                        }
                        .cost-table .label {
                            font-weight: bold;
                            width: 50%;
                            background-color: #f5f5f5;
                        }
                        .comments {
                            margin-bottom: 20px;
                            padding: 10px;
                            border: 1px solid #000;
                            background-color: #f9f9f9;
                            font-size: 12px;
                        }
                        .signatures {
                            margin-top: 50px;
                            display: flex;
                            justify-content: space-between;
                        }
                        .signature-block {
                            width: 45%;
                            text-align: center;
                        }
                        .signature-line {
                            border-top: 1px solid #000;
                            margin: 50px 0 5px 0;
                        }
                        .signature-name {
                            font-size: 12px;
                        }
                        .stamp-place {
                            height: 100px;
                            border: 1px dashed #999;
                            margin-top: 20px;
                            text-align: center;
                            line-height: 100px;
                            color: #999;
                        }
                        .footer {
                            margin-top: 30px;
                            font-size: 10px;
                            text-align: center;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Акт об оказании услуг №${docId}</h1>
                        <div class="document-number">от ${new Date(doc.creationdate).toLocaleDateString('ru-RU')}</div>
                    </div>
                    
                    <div class="company-info">
                        <strong>Клининговая компания "Чистота"</strong><br>
                        ИНН 1234567890, ОГРН 1234567890123<br>
                        г. Москва, ул. Чистая, д. 1<br>
                        Тел.: +7 (495) 123-45-67
                    </div>
                    
                    <div class="parties">
                        <h2>1. СТОРОНЫ</h2>
                        <table class="parties-table">
                            <tr>
                                <td class="label">Исполнитель:</td>
                                <td>
                                    <strong>Клининговая компания "Чистота"</strong><br>
                                    ИНН 1234567890, ОГРН 1234567890123<br>
                                    Адрес: г. Москва, ул. Чистая, д. 1<br>
                                    Тел.: +7 (495) 123-45-67
                                </td>
                            </tr>
                            <tr>
                                <td class="label">Заказчик:</td>
                                <td>
                                    <strong>${order.client_fio || 'Не указан'}</strong><br>
                                    Телефон: ${order.client_phone || 'Не указан'}<br>
                                    Адрес объекта: ${order.object_address || 'Не указан'}
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">2. ПЕРЕЧЕНЬ ОКАЗАННЫХ УСЛУГ</div>
                        <table class="services-table">
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Наименование услуги</th>
                                    <th>Описание</th>
                                    <th>Стоимость за м²</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${services.map((service, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${service.label || 'Услуга'}</td>
                                        <td>${service.description || '-'}</td>
                                        <td>${service.price ? service.price.toLocaleString('ru-RU') + ' ₽' : '0 ₽'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">3. РАСЧЕТ СТОИМОСТИ</div>
                        <table class="cost-table">
                            <tr>
                                <td class="label">Сумма стоимостей услуг (за м²):</td>
                                <td>${servicesTotal.toLocaleString('ru-RU')} ₽</td>
                            </tr>
                            <tr>
                                <td class="label">Площадь объекта:</td>
                                <td>${order.squaremeterage ? order.squaremeterage + ' м²' : 'Не указана'}</td>
                            </tr>
                            <tr>
                                <td class="label">Общая стоимость выполненных работ:</td>
                                <td><strong>${totalCost.toLocaleString('ru-RU')} ₽</strong></td>
                            </tr>
                            <tr>
                                <td class="label">Сумма прописью:</td>
                                <td>${numberToWords(totalCost)} рублей</td>
                            </tr>
                        </table>
                    </div>
                    
                    ${doc.comments_d ? `
                        <div class="section">
                            <div class="section-title">4. КОММЕНТАРИИ И ЗАМЕЧАНИЯ</div>
                            <div class="comments">
                                ${doc.comments_d}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="section">
                        <div class="section-title">5. ПОДТВЕРЖДЕНИЕ ВЫПОЛНЕНИЯ РАБОТ</div>
                        <p>Настоящим Заказчик подтверждает, что:</p>
                        <p>1. Услуги, указанные в разделе 2 настоящего Акта, оказаны в полном объеме.</p>
                        <p>2. Качество оказанных услуг соответствует требованиям и согласовано сторонами.</p>
                        <p>3. Претензий к объему, качеству и срокам оказания услуг не имеется.</p>
                    </div>
                    
                    <div class="signatures">
                        <div class="signature-block">
                            <div><strong>Исполнитель:</strong></div>
                            <div>Клининговая компания "Чистота"</div>
                            <div class="signature-line"></div>
                            <div class="signature-name">подпись, расшифровка подписи</div>
                            <div class="stamp-place">Печать организации</div>
                        </div>
                        
                        <div class="signature-block">
                            <div><strong>Заказчик:</strong></div>
                            <div>${order.client_fio || '________________'}</div>
                            <div class="signature-line"></div>
                            <div class="signature-name">подпись, расшифровка подписи</div>
                            <div class="stamp-place">М.П. (при наличии)</div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        Документ сгенерирован автоматически. Не требует ручного заполнения.
                    </div>
                </body>
                </html>
            `;
        }
        
        res.send(htmlContent);
        
    } catch (error) {
        console.error('Error generating document view:', error);
        res.status(500).send('Ошибка генерации документа');
    }
});

// Вспомогательная функция для преобразования числа в слова
function numberToWords(num) {
    const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
    
    if (num === 0) return 'ноль';
    
    let result = '';
    let number = Math.floor(num);
    
    // Тысячи
    if (number >= 1000) {
        const thousands = Math.floor(number / 1000);
        if (thousands === 1) result += 'одна тысяча ';
        else if (thousands === 2) result += 'две тысячи ';
        else if (thousands >= 3 && thousands <= 4) result += units[thousands] + ' тысячи ';
        else result += units[thousands] + ' тысяч ';
        number %= 1000;
    }
    
    // Сотни
    if (number >= 100) {
        result += hundreds[Math.floor(number / 100)] + ' ';
        number %= 100;
    }
    
    // Десятки и единицы
    if (number >= 20) {
        result += tens[Math.floor(number / 10)] + ' ';
        number %= 10;
        if (number > 0) result += units[number] + ' ';
    } else if (number >= 10) {
        result += teens[number - 10] + ' ';
        number = 0;
    } else if (number > 0) {
        result += units[number] + ' ';
    }
    
    return result.trim() + ' рублей';
}

// Получение списка всех клиентов
router.get('/clients/list', async function(req, res) {
    try {
        let clients = await req.db.any(`
            SELECT id, fio, phone, email, type_l FROM clients ORDER BY fio
        `);
        res.json(clients);
    } catch (error) {
        console.error('Error loading clients:', error);
        res.status(500).json({ error: 'Ошибка загрузки клиентов' });
    }
});

// Получение объектов уборки для конкретного клиента
router.get('/clients/:clientId/objects', async function(req, res) {
    try {
        const clientId = parseInt(req.params.clientId);
        let objects = await req.db.any(`
            SELECT 
                id,
                type_CO,
                address,
                squareMeterage,
                description
            FROM clean_objects 
            WHERE id_cl = $1
            ORDER BY address
        `, [clientId]);
        
        res.json(objects);
    } catch (error) {
        console.error('Error loading client objects:', error);
        res.status(500).json({ error: 'Ошибка загрузки объектов уборки' });
    }
});

// Получение всех услуг
router.get('/services/list', async function(req, res) {
    try {
        let services = await req.db.any(`
            SELECT 
                id,
                label,
                description
            FROM services 
            ORDER BY label
        `);
        res.json(services);
    } catch (error) {
        console.error('Error loading services:', error);
        res.status(500).json({ error: 'Ошибка загрузки услуг' });
    }
});

// Получение цены для услуги из активного прайс-листа
router.get('/services/:serviceId/price', async function(req, res) {
    try {
        const serviceId = parseInt(req.params.serviceId);
        
        // Находим активный прайс-лист
        const activePriceList = await req.db.oneOrNone(`
            SELECT id FROM pricelists 
            WHERE isActive = true 
            AND CURRENT_DATE BETWEEN validFrom AND validTo
            LIMIT 1
        `);
        
        if (!activePriceList) {
            return res.json({ price: 0, message: 'Активный прайс-лист не найден' });
        }
        
        // Получаем цену услуги
        const priceItem = await req.db.oneOrNone(`
            SELECT price FROM pricelists_items 
            WHERE id_serv = $1 AND id_pricelist = $2
        `, [serviceId, activePriceList.id]);
        
        if (!priceItem) {
            return res.json({ price: 0, message: 'Цена для услуги не найдена' });
        }
        
        res.json({ price: priceItem.price });
        
    } catch (error) {
        console.error('Error loading service price:', error);
        res.status(500).json({ error: 'Ошибка загрузки цены услуги' });
    }
});

// Создание нового клиента (и пользователя)
router.post('/clients/create', async function(req, res) {
    try {
        const client = req.body;
        
        // Валидация
        if (!client.fio || !client.phone || !client.login || !client.password) {
            return res.json({success: false, error: 'Заполните все обязательные поля'});
        }
        
        // Проверяем, существует ли уже пользователь с таким логином
        const existingUser = await req.db.oneOrNone(
            'SELECT id FROM users WHERE login = $1', 
            [client.login]
        );
        
        if (existingUser) {
            return res.json({success: false, error: 'Пользователь с таким логином уже существует'});
        }
        
        // Хешируем пароль
        const hashedPassword = client.password;
        
        // Используем транзакцию для создания пользователя и клиента
        const result = await req.db.tx(async t => {
            // Создаем пользователя
            const newUser = await t.one(
                `INSERT INTO users (login, pass, id_role) 
                 VALUES ($1, $2, $3::roles) 
                 RETURNING id`,
                [client.login, hashedPassword, 'Клиент']
            );
            
            // Создаем клиента
            const newClient = await t.one(
                `INSERT INTO clients (fio, phone, email, type_l, id_pol) 
                 VALUES ($1, $2, $3, $4::types_l, $5) 
                 RETURNING id, fio`,
                [
                    client.fio,
                    client.phone,
                    client.email || null,
                    client.type_l || 'Физическое лицо',
                    newUser.id
                ]
            );
            
            return { user: newUser, client: newClient };
        });
        
        res.json({ 
            success: true, 
            message: 'Клиент и пользователь успешно созданы',
            client: result.client
        });
        
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания клиента: ' + error.message });
    }
});

// Создание нового объекта уборки
router.post('/objects/create', async function(req, res) {
    try {
        const object = req.body;
        
        // Валидация
        if (!object.id_cl || !object.address) {
            return res.json({success: false, error: 'Обязательные поля: клиент и адрес'});
        }
        
        const result = await req.db.one(`
            INSERT INTO clean_objects (type_CO, id_cl, address, squareMeterage, description) 
            VALUES ($1::types_CO, $2, $3, $4, $5)
            RETURNING id, address
        `, [
            object.type_CO || 'Квартира',
            parseInt(object.id_cl),
            object.address,
            object.squareMeterage ? parseInt(object.squareMeterage) : null,
            object.description || null
        ]);
        
        res.json({ success: true, object: result });
        
    } catch (error) {
        console.error('Error creating clean object:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания объекта уборки: ' + error.message });
    }
});

// Обновление заказа
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let order = req.body;
    
    if (!order.id_client || !order.totalCost) {
        return res.send({msg: 'Обязательные поля: клиент и общая стоимость'});
    }

    try {
        const creationDate = order.creationDate ? new Date(order.creationDate) : null;
        const plannedDate = order.plannedDate ? new Date(order.plannedDate) : null;
        
        await req.db.none(`
            UPDATE orders SET 
                id_status = $1::order_statuses,
                creationDate = $2,
                id_client = $3,
                totalCost = $4,
                plannedDate = $5,
                description = $6
            WHERE id = $7
        `, [
            order.status || 'Новый',
            creationDate,
            parseInt(order.id_client),
            parseInt(order.totalCost),
            plannedDate,
            order.description || null,
            id
        ]);
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении заказа: ' + error.message});
    }
});

router.get('/edit/:id', async function(req, res) {
    try {
        let id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).send('Неверный ID заказа');

        // Получаем данные заказа
        let order = await req.db.oneOrNone(`
            SELECT * FROM orders WHERE id = $1
        `, [id]);

        if (!order) return res.status(404).send('Заказ не найден');

        // Получаем список клиентов
        let clients = await req.db.any('SELECT id, fio FROM clients ORDER BY fio');
        
        // Получаем все статусы
        let statuses = await req.db.any(`SELECT unnest(enum_range(NULL::order_statuses)) AS status`);
        
        // Получаем услуги заказа
        let orderServices = await req.db.any(`
            SELECT 
                orders_items.id_serv,
                orders_items.price,
                services.label
            FROM orders_items
            LEFT JOIN services ON orders_items.id_serv = services.id
            WHERE orders_items.id_order = $1
        `, [id]);
        
        // Получаем все услуги для выбора
        let allServices = await req.db.any('SELECT id, label FROM services ORDER BY label');

        res.render('orders/edit', {
            title: 'Редактирование заказа #' + id,
            order: order,
            clients: clients,
            statuses: statuses,
            orderServices: orderServices,
            allServices: allServices
        });
        
    } catch (error) {
        console.error('Error loading order for edit:', error);
        res.status(500).send('Ошибка загрузки данных заказа');
    }
});

// Обновленный маршрут для редактирования заказа с услугами
router.post('/edit/:id', async function(req, res) {
    try {
        const orderId = parseInt(req.params.id);
        const { order, services, objectSquare } = req.body;
        
        if (isNaN(orderId)) {
            return res.json({ success: false, error: 'Неверный ID заказа' });
        }
        
        // Валидация
        if (!order.id_client) {
            return res.json({ success: false, error: 'Выберите клиента' });
        }
        
        if (!services || services.length === 0) {
            return res.json({ success: false, error: 'Добавьте хотя бы одну услугу' });
        }
        
        // Проверяем существование заказа
        const orderExists = await req.db.oneOrNone('SELECT id FROM orders WHERE id = $1', [orderId]);
        if (!orderExists) {
            return res.json({ success: false, error: 'Заказ не найден' });
        }
        
        // Рассчитываем стоимость
        let servicesTotal = 0;
        services.forEach(service => {
            servicesTotal += parseInt(service.price) || 0;
        });
        
        let totalCost = 0;
        if (objectSquare && objectSquare > 0) {
            totalCost = servicesTotal * parseInt(objectSquare);
        } else {
            totalCost = servicesTotal;
        }
        
        // Преобразуем даты
        const creationDate = order.creationDate ? new Date(order.creationDate) : new Date();
        const plannedDate = order.plannedDate ? new Date(order.plannedDate) : null;
        
        // Используем транзакцию
        await req.db.tx(async t => {
            // Обновляем заказ
            await t.none(`
                UPDATE orders SET
                    id_status = $1::order_statuses,
                    creationdate = $2,
                    id_client = $3,
                    totalcost = $4,
                    planneddate = $5,
                    description = $6,
                    id_clean_object = $7
                WHERE id = $8
            `, [
                order.id_status || 'Новый',
                creationDate,
                parseInt(order.id_client),
                totalCost,
                plannedDate,
                order.description || null,
                order.id_clean_object ? parseInt(order.id_clean_object) : null,
                orderId
            ]);
            
            // Удаляем старые услуги
            await t.none('DELETE FROM orders_items WHERE id_order = $1', [orderId]);
            
            // Добавляем новые услуги
            for (const service of services) {
                await t.none(`
                    INSERT INTO orders_items (id_order, id_serv, price)
                    VALUES ($1, $2, $3)
                `, [orderId, parseInt(service.id), parseInt(service.price)]);
            }
        });
        
        res.json({ success: true, orderId: orderId });
        
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ success: false, error: 'Ошибка обновления заказа: ' + error.message });
    }
});

// Улучшенный маршрут удаления с проверкой документов
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    if (isNaN(id)) return res.json({ success: false, error: 'Неверный ID заказа' });
    
    try {
        // Проверяем существование заказа
        const orderExists = await req.db.oneOrNone('SELECT id, id_status FROM orders WHERE id = $1', [id]);
        if (!orderExists) return res.json({ success: false, error: 'Заказ не найден' });
        
        // Проверяем, можно ли удалять заказ (например, нельзя удалить завершенные заказы)
        if (orderExists.id_status === 'Завершён' || orderExists.id_status === 'Заказ оплачен') {
            return res.json({ 
                success: false, 
                error: 'Нельзя удалить заказ со статусом "' + orderExists.id_status + '". Измените статус заказа.' 
            });
        }
        
        // Проверяем наличие документов
        const hasDocuments = await req.db.oneOrNone('SELECT id FROM docs WHERE id_order = $1 LIMIT 1', [id]);
        if (hasDocuments) {
            return res.json({ 
                success: false, 
                error: 'Нельзя удалить заказ с привязанными документами. Сначала удалите документы.' 
            });
        }
        
        // Используем транзакцию
        await req.db.tx(async t => {
            // Удаляем услуги заказа
            await t.none('DELETE FROM orders_items WHERE id_order = $1', [id]);
            
            // Удаляем заказ
            await t.none('DELETE FROM orders WHERE id = $1', [id]);
        });
        
        res.json({ success: true, message: 'Заказ успешно удален' });
        
    } catch (error) {
        console.error('Delete error:', error);
        res.json({ success: false, error: 'Ошибка при удалении заказа: ' + error.message });
    }
});

// Удаление заказа
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    if (isNaN(id)) return res.send({msg: 'Неверный ID заказа'});
    
    try {
        const orderExists = await req.db.oneOrNone('SELECT id FROM orders WHERE id = $1', [id]);
        if (!orderExists) return res.send({msg: 'Заказ не найден'});
        
        // Удаляем связанные записи
        await req.db.none('DELETE FROM orders_items WHERE id_order = $1', [id]);
        
        // Удаляем заказ
        await req.db.none('DELETE FROM orders WHERE id = $1', [id]);
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении заказа: ' + error.message});
    }
});

module.exports = router;