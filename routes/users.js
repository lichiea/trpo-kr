var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {
    var user = session.auth(req).user;
    var can_view_users = user && user.id_role ? true : false;

    let users = await req.db.any(`
        SELECT
            users.id AS id,
            users.login AS login,
            users.pass AS pass,
            users.id_role AS id_role
        FROM
            users
    `);
    
    console.log(users);
    res.render('users/list', { 
        title: 'Пользователи', 
        users: users, 
        can_view_users: can_view_users 
    });
});

router.post('/create', async function(req, res, next) {
    let userData = req.body;
    
    // Валидация
    if (!userData.login || !userData.pass || !userData.id_role) {
        return res.send({msg: 'Обязательные поля: логин, пароль и роль'});
    }

    try {
        await req.db.none(
            'INSERT INTO users(login, pass, id_role) VALUES(${login}, ${pass}, ${id_role})', 
            userData
        );
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
                employees.position_d AS employee_position
            FROM
                employees
            WHERE
                employees.id_pol = ${id}
        `);

        res.render('users/view', { 
            title: 'Пользователь: ' + userData.login, 
            userData: userData, 
            employeeData: employeeData,
            can_view_users: can_view_users 
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

    try {
        // Если пароль не указан, не обновляем его
        let updateQuery = `
            UPDATE users 
            SET 
                login = $1,
                id_role = $2
        `;
        
        let params = [
            userData.login,
            userData.id_role,
            id
        ];
        
        // Добавляем пароль, если он указан
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
            updateQuery += ` WHERE id = $3`;
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

module.exports = router;