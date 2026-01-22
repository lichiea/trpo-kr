var express = require('express');
var router = express.Router();

// Список допустимых ролей (из ENUM)
const ROLES = ['Администратор', 'Менеджер', 'Бригадир', 'Клинер', 'Клиент'];
const USER_TYPES = ['Сотрудник', 'Клиент'];
const CLIENT_TYPES = ['Физическое лицо', 'Юридическое лицо'];

// Функция для получения класса CSS для роли
const getRoleClass = (role) => {
    const roleClasses = {
        'Администратор': 'role-admin',
        'Менеджер': 'role-manager',
        'Бригадир': 'role-taskmaster',
        'Клинер': 'role-cleaner',
        'Клиент': 'role-client'
    };
    return roleClasses[role] || 'role-default';
};

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user;
    var can_view_users = user && user.id_role ? true : false;

    // Получаем параметры фильтрации и поиска из query string
    const roleFilter = req.query.role || '';
    const searchQuery = req.query.search || '';
    
    // Строим базовый запрос
    let query = `
        SELECT
            users.id AS id,
            users.login AS login,
            users.pass AS pass,
            users.id_role AS id_role,
            CASE
                WHEN employees.id IS NOT NULL THEN employees.fio
                WHEN clients.id IS NOT NULL THEN clients.fio
                ELSE NULL
            END AS full_name,
            CASE
                WHEN employees.id IS NOT NULL THEN 'Сотрудник'
                WHEN clients.id IS NOT NULL THEN 'Клиент'
                ELSE 'Только пользователь'
            END AS user_type
        FROM
            users
        LEFT JOIN employees ON users.id = employees.id_pol
        LEFT JOIN clients ON users.id = clients.id_pol
        WHERE 1=1
    `;
    
    let params = [];
    let paramCount = 0;
    
    // Добавляем фильтр по роли
    if (roleFilter && roleFilter !== 'all') {
        paramCount++;
        query += ` AND users.id_role = $${paramCount}`;
        params.push(roleFilter);
    }
    
    // Добавляем поиск по ФИО (в таблицах employees или clients)
    if (searchQuery) {
        paramCount++;
        query += ` AND (
            employees.fio ILIKE $${paramCount} OR 
            clients.fio ILIKE $${paramCount} OR
            users.login ILIKE $${paramCount}
        )`;
        params.push(`%${searchQuery}%`);
    }
    
    query += ` ORDER BY users.id`;
    
    let users = await req.db.any(query, params);
    
    // Добавляем вычисление класса для ролей каждому пользователю
    users.forEach(user => {
        user.roleClass = getRoleClass(user.id_role);
    });
    
    console.log('Filtered users:', users.length);
    res.render('users/list', { 
        title: 'Пользователи', 
        users: users, 
        can_view_users: can_view_users,
        roles: ROLES,
        user_types: USER_TYPES,
        client_types: CLIENT_TYPES,
        current_role: roleFilter,
        current_search: searchQuery
    });
});


router.post('/create', async function(req, res, next) {
    let userData = req.body;
    
    console.log('Create user data:', userData);
    
    // Валидация
    if (!userData.fio || !userData.login || !userData.pass || !userData.user_type) {
        return res.send({msg: 'Обязательные поля: ФИО, логин, пароль и тип пользователя'});
    }
    
    // Если тип пользователя - сотрудник, проверяем роль
    if (userData.user_type === 'Сотрудник' && !userData.id_role) {
        return res.send({msg: 'Для сотрудника необходимо указать роль'});
    }
    
    // Если тип пользователя - клиент, устанавливаем роль "Клиент"
    if (userData.user_type === 'Клиент') {
        userData.id_role = 'Клиент';
        
        // Для клиента проверяем тип лица
        if (!userData.type_l) {
            return res.send({msg: 'Для клиента необходимо указать тип лица (физическое/юридическое)'});
        }
        
        if (!CLIENT_TYPES.includes(userData.type_l)) {
            return res.send({msg: 'Неверный тип лица. Допустимые значения: ' + CLIENT_TYPES.join(', ')});
        }
    }
    
    // Проверяем, что роль из допустимого списка
    if (userData.id_role && !ROLES.includes(userData.id_role)) {
        return res.send({msg: 'Неверная роль. Допустимые значения: ' + ROLES.join(', ')});
    }
    
    try {
        // Начинаем транзакцию
        await req.db.tx(async t => {
            // 1. Создаем запись в таблице users
            const newUser = await t.one(
                'INSERT INTO users(login, pass, id_role) VALUES($1, $2, $3) RETURNING id',
                [userData.login, userData.pass, userData.id_role]
            );
            
            const userId = newUser.id;
            
            // 2. В зависимости от типа пользователя создаем запись в соответствующей таблице
            if (userData.user_type === 'Сотрудник') {
                // Для сотрудника - таблица employees
                await t.none(
                    `INSERT INTO employees(fio, phone, email, position_d, specialization, id_pol) 
                     VALUES($1, $2, $3, $4, $5, $6)`,
                    [
                        userData.fio,
                        userData.phone || null,
                        userData.email || null,
                        userData.position_d || null,
                        userData.specialization || null,
                        userId
                    ]
                );
            } else if (userData.user_type === 'Клиент') {
                // Для клиента - таблица clients
                await t.none(
                    `INSERT INTO clients(fio, phone, email, type_l, id_pol) 
                     VALUES($1, $2, $3, $4, $5)`,
                    [
                        userData.fio,
                        userData.phone || null,
                        userData.email || null,
                        userData.type_l,
                        userId
                    ]
                );
            }
        });
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании пользователя: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
        return res.status(400).send('Invalid user ID');

    var user = session.auth(req).user;
    var can_view_users = user && user.id_role ? true : false;

    try {
        // Получаем данные пользователя
        let userData = await req.db.one(`
            SELECT
                users.id AS id,
                users.login AS login,
                users.pass AS pass,
                users.id_role AS id_role
            FROM
                users
            WHERE
                users.id = ${id}
        `);

        // Получаем связанного сотрудника (если есть)
        let employeeData = await req.db.oneOrNone(`
            SELECT
                employees.id AS employee_id,
                employees.fio AS employee_fio,
                employees.position_d AS employee_position,
                employees.phone AS employee_phone,
                employees.email AS employee_email,
                employees.specialization AS employee_specialization
            FROM
                employees
            WHERE
                employees.id_pol = ${id}
        `);

        // Получаем связанного клиента (если есть)
        let clientData = await req.db.oneOrNone(`
            SELECT
                clients.id AS client_id,
                clients.fio AS client_fio,
                clients.phone AS client_phone,
                clients.email AS client_email,
                clients.type_l AS client_type
            FROM
                clients
            WHERE
                clients.id_pol = ${id}
        `);

        // Определяем тип пользователя
        let user_type = 'Только пользователь';
        if (employeeData) user_type = 'Сотрудник';
        else if (clientData) user_type = 'Клиент';

        res.render('users/view', { 
            title: 'Пользователь: ' + userData.login, 
            userData: userData, 
            employeeData: employeeData,
            clientData: clientData,
            can_view_users: can_view_users,
            roles: ROLES,
            user_types: USER_TYPES,
            client_types: CLIENT_TYPES,
            user_type: user_type
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для обновления пользователя
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let userData = req.body;
    
    console.log('Update request for user ID:', id);
    console.log('Data received:', userData);

    // Валидация
    if (!userData.login || !userData.id_role) {
        return res.send({msg: 'Обязательные поля: логин и роль'});
    }

    // Проверяем, что роль из допустимого списка
    if (!ROLES.includes(userData.id_role)) {
        return res.send({msg: 'Неверная роль. Допустимые значения: ' + ROLES.join(', ')});
    }

    try {
        // Если пароль не указан, не обновляем его
        let updateQuery = '';
        let params = [];
        
        if (userData.pass && userData.pass.trim() !== '') {
            updateQuery = `
                UPDATE users 
                SET 
                    login = $1,
                    pass = $2,
                    id_role = $3
                WHERE id = $4
            `;
            params = [
                userData.login,
                userData.pass,
                userData.id_role,
                id
            ];
        } else {
            updateQuery = `
                UPDATE users 
                SET 
                    login = $1,
                    id_role = $2
                WHERE id = $3
            `;
            params = [
                userData.login,
                userData.id_role,
                id
            ];
        }
        
        await req.db.none(updateQuery, params);
        
        console.log('User updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении пользователя: ' + error.message});
    }
});

// Роут для удаления пользователя
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for user ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID пользователя'});
    }
    
    try {
        // Проверяем, существует ли пользователь
        const userExists = await req.db.oneOrNone(
            'SELECT id FROM users WHERE id = $1',
            [id]
        );
        
        if (!userExists) {
            return res.send({msg: 'Пользователь не найден'});
        }
        
        // Проверяем, не связан ли пользователь с сотрудником
        const hasEmployee = await req.db.oneOrNone(
            'SELECT id FROM employees WHERE id_pol = $1',
            [id]
        );
        
        if (hasEmployee) {
            return res.send({msg: 'Невозможно удалить пользователя, так как он связан с сотрудником. Сначала удалите связь с сотрудником.'});
        }
        
        // Проверяем, не связан ли пользователь с клиентом
        const hasClient = await req.db.oneOrNone(
            'SELECT id FROM clients WHERE id_pol = $1',
            [id]
        );
        
        if (hasClient) {
            return res.send({msg: 'Невозможно удалить пользователя, так как он связан с клиентом. Сначала удалите связь с клиентом.'});
        }
        
        // Удаляем пользователя
        await req.db.none(
            'DELETE FROM users WHERE id = $1',
            [id]
        );
        
        console.log('User deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении пользователя: ' + error.message});
    }
});

// 
router.get('/by-role/:role', async function(req, res) {
    let role = req.params.role;
    try {
        let users = await req.db.any(`
            SELECT
                users.id AS id,
                users.login AS login,
                employees.fio AS fio,
                employees.position_d AS position_d
            FROM
                users
            LEFT JOIN employees ON users.id = employees.id_pol
            WHERE
                users.id_role = $1
            AND employees.id IS NOT NULL
            ORDER BY
                employees.fio, users.login
        `, role)
        res.json(users)
    } catch (error) {
        console.error('Error fetching users by role:', error);
        res.status(500).json({error: 'Ошибка сервера'});
    }
});

module.exports = router;