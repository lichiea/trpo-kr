var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_teams = user && user.id_role ? true : false

    let teams = await req.db.any(`
        SELECT
            teams.id AS id,
            teams.id_taskmaster AS id_taskmaster,
            taskmaster.fio AS taskmaster_fio,
            taskmaster.position_d AS taskmaster_position,
            COALESCE(members_count.count, 0) AS members_count
        FROM
            teams
        LEFT JOIN employees AS taskmaster ON teams.id_taskmaster = taskmaster.id
        LEFT JOIN (
            SELECT id_team, COUNT(id_employee) as count
            FROM team_items
            GROUP BY id_team
        ) AS members_count ON teams.id = members_count.id_team
        ORDER BY teams.id
    `)
    console.log(teams)
    res.render('teams/list', { title: 'Бригады', teams: teams, can_view_teams: can_view_teams })

});

router.post('/create', async function(req, res, next) {
    let team = req.body;
    
    // Валидация
    if (!team.id_taskmaster) {
        return res.send({msg: 'Обязательное поле: бригадир'});
    }

    try {
        // Проверяем, что выбранный пользователь имеет роль Бригадир
        const userCheck = await req.db.oneOrNone(`
            SELECT id_role FROM users WHERE id = $1
        `, [team.id_taskmaster]);
        
        if (!userCheck || userCheck.id_role !== 'Бригадир') {
            return res.send({msg: 'Выбранный пользователь не является бригадиром'});
        }

        // Получаем id сотрудника по id пользователя
        const employee = await req.db.oneOrNone(`
            SELECT id FROM employees WHERE id_pol = $1
        `, [team.id_taskmaster]);
        
        if (!employee) {
            return res.send({msg: 'Для выбранного пользователя не создан профиль сотрудника'});
        }

        await req.db.none(
            'INSERT INTO teams(id_taskmaster) VALUES($1)', 
            [employee.id]
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании бригады: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid team ID');

    var user = session.auth(req).user
    var can_view_teams = user && user.id_role ? true : false

    try {
        // Получаем данные бригады
        let team = await req.db.oneOrNone(`
            SELECT
                teams.id AS id,
                teams.id_taskmaster AS id_taskmaster,
                taskmaster.fio AS taskmaster_fio,
                taskmaster.position_d AS taskmaster_position,
                taskmaster.id_pol AS taskmaster_user_id,
                users_taskmaster.login AS taskmaster_login,
                users_taskmaster.id_role AS taskmaster_role
            FROM
                teams
            LEFT JOIN employees AS taskmaster ON teams.id_taskmaster = taskmaster.id
            LEFT JOIN users AS users_taskmaster ON taskmaster.id_pol = users_taskmaster.id
            WHERE
                teams.id = ${id}
        `)

        if (!team) {
            return res.status(404).send('Бригада не найдена');
        }

        // Получаем членов бригады
        let team_members = await req.db.any(`
            SELECT
                team_items.id AS item_id,
                employees.id AS employee_id,
                employees.fio AS employee_fio,
                employees.position_d AS employee_position,
                employees.id_pol AS employee_user_id,
                users.login AS employee_login
            FROM
                team_items
            LEFT JOIN employees ON team_items.id_employee = employees.id
            LEFT JOIN users ON employees.id_pol = users.id
            WHERE
                team_items.id_team = ${id}
            AND users.id_role = 'Клинер'
            ORDER BY employees.fio
        `)

        // Получаем список пользователей с ролью Бригадир
        let taskmasters = await req.db.any(`
            SELECT
                users.id AS user_id,
                users.login AS login,
                employees.id AS employee_id,
                employees.fio AS fio,
                employees.position_d AS position_d
            FROM
                users
            LEFT JOIN employees ON users.id = employees.id_pol
            WHERE
                users.id_role = 'Бригадир'
            AND employees.id IS NOT NULL
            ORDER BY
                employees.fio
        `)

        // Получаем список пользователей с ролью Клинер
        let cleaners = await req.db.any(`
            SELECT
                users.id AS user_id,
                users.login AS login,
                employees.id AS employee_id,
                employees.fio AS fio,
                employees.position_d AS position_d
            FROM
                users
            LEFT JOIN employees ON users.id = employees.id_pol
            WHERE
                users.id_role = 'Клинер'
            AND employees.id IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM team_items 
                WHERE team_items.id_employee = employees.id 
                AND team_items.id_team = ${id}
            )
            ORDER BY
                employees.fio
        `)

        // Получаем заказы, назначенные на бригаду через docs_wo
        let team_orders = await req.db.any(`
            SELECT
                orders.id AS order_id,
                orders.id_status AS order_status,
                orders.creationDate AS creation_date,
                orders.plannedDate AS planned_date,
                orders.totalCost AS total_cost,
                orders.description AS order_description,
                clients.fio AS client_fio,
                clients.phone AS client_phone,
                docs.type_doc AS document_type,
                docs.creationDate AS document_date,
                docs_wo.id AS docs_wo_id,
                docs_wo.clientSign AS client_signed,
                docs_wo.employeeSign AS employee_signed
            FROM
                docs_wo
            INNER JOIN docs ON docs_wo.id_doc = docs.id
            INNER JOIN orders ON docs.id_order = orders.id
            INNER JOIN clients ON orders.id_client = clients.id
            WHERE
                docs_wo.id_team = ${id}
            ORDER BY
                orders.plannedDate DESC,
                orders.creationDate DESC
        `)

        // Получаем статистику по заказам
        let orders_stats = await req.db.one(`
            SELECT
                COUNT(*) as total_orders,
                SUM(CASE WHEN orders.id_status = 'Заказ в работе' THEN 1 ELSE 0 END) as active_orders,
                SUM(CASE WHEN orders.id_status = 'Заказ выполнен' THEN 1 ELSE 0 END) as completed_orders,
                SUM(CASE WHEN orders.id_status = 'Завершён' THEN 1 ELSE 0 END) as closed_orders
            FROM
                docs_wo
            INNER JOIN docs ON docs_wo.id_doc = docs.id
            INNER JOIN orders ON docs.id_order = orders.id
            WHERE
                docs_wo.id_team = ${id}
        `)

        console.log('View team:', {
            teamId: id,
            taskmaster: team.taskmaster_fio,
            membersCount: team_members.length,
            ordersCount: team_orders.length,
            stats: orders_stats
        });

        res.render('teams/view', { 
            title: 'Бригада №' + team.id, 
            team: team, 
            team_members: team_members,
            taskmasters: taskmasters,
            cleaners: cleaners,
            team_orders: team_orders,
            orders_stats: orders_stats,
            can_view_teams: can_view_teams 
        })

    } catch (error) {
        console.error('Error fetching team details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }
});

// Роут для обновления бригады
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let team = req.body;
    
    console.log('Update request for team ID:', id);
    console.log('Data received:', team);

    // Валидация
    if (!team.id_taskmaster) {
        return res.send({msg: 'Обязательное поле: бригадир'});
    }

    try {
        // Проверяем, что выбранный пользователь имеет роль Бригадир
        const userCheck = await req.db.oneOrNone(`
            SELECT id_role FROM users WHERE id = $1
        `, [team.id_taskmaster]);
        
        if (!userCheck || userCheck.id_role !== 'Бригадир') {
            return res.send({msg: 'Выбранный пользователь не является бригадиром'});
        }

        // Получаем id сотрудника по id пользователя
        const employee = await req.db.oneOrNone(`
            SELECT id FROM employees WHERE id_pol = $1
        `, [team.id_taskmaster]);
        
        if (!employee) {
            return res.send({msg: 'Для выбранного пользователя не создан профиль сотрудника'});
        }

        await req.db.none(`
            UPDATE teams 
            SET 
                id_taskmaster = $1
            WHERE id = $2
        `, [
            employee.id,
            id
        ]);
        
        console.log('Team updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении бригады: ' + error.message});
    }
});

// Роут для добавления сотрудника в бригаду
router.post('/:id/add-member', async function(req, res) {
    let team_id = parseInt(req.params.id);
    let member = req.body;
    
    if (isNaN(team_id)) {
        return res.send({msg: 'Неверный ID бригады'});
    }

    try {
        // Проверяем, что выбранный пользователь имеет роль Клинер
        const userCheck = await req.db.oneOrNone(`
            SELECT id_role FROM users WHERE id = $1
        `, [member.user_id]);
        
        if (!userCheck || userCheck.id_role !== 'Клинер') {
            return res.send({msg: 'Выбранный пользователь не является клинером'});
        }

        // Получаем id сотрудника по id пользователя
        const employee = await req.db.oneOrNone(`
            SELECT id FROM employees WHERE id_pol = $1
        `, [member.user_id]);
        
        if (!employee) {
            return res.send({msg: 'Для выбранного пользователя не создан профиль сотрудника'});
        }

        // Проверяем, не состоит ли уже сотрудник в бригаде
        const exists = await req.db.oneOrNone(
            'SELECT id FROM team_items WHERE id_team = $1 AND id_employee = $2',
            [team_id, employee.id]
        );
        
        if (exists) {
            return res.send({msg: 'Сотрудник уже состоит в этой бригаде'});
        }

        await req.db.none(
            'INSERT INTO team_items(id_team, id_employee) VALUES($1, $2)',
            [team_id, employee.id]
        );
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Add member error:', error);
        res.send({msg: 'Ошибка при добавлении сотрудника: ' + error.message});
    }
});

// Роут для удаления сотрудника из бригады
router.delete('/:id/remove-member/:item_id', async function(req, res) {
    let item_id = parseInt(req.params.item_id);
    
    if (isNaN(item_id)) {
        return res.send({msg: 'Неверный ID записи'});
    }
    
    try {
        await req.db.none(
            'DELETE FROM team_items WHERE id = $1',
            [item_id]
        );
        
        res.send({msg: ''});
    } catch (error) {
        console.error('Remove member error:', error);
        res.send({msg: 'Ошибка при удалении сотрудника из бригады: ' + error.message});
    }
});

// Роут для удаления бригады
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for team ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID бригады'});
    }
    
    try {
        // Проверяем, существует ли бригада
        const teamExists = await req.db.oneOrNone(
            'SELECT id FROM teams WHERE id = $1',
            [id]
        );
        
        if (!teamExists) {
            return res.send({msg: 'Бригада не найдена'});
        }
        
        // Удаляем всех членов бригады
        await req.db.none(
            'DELETE FROM team_items WHERE id_team = $1',
            [id]
        );
        
        // Удаляем саму бригаду
        await req.db.none(
            'DELETE FROM teams WHERE id = $1',
            [id]
        );
        
        console.log('Team deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении бригады: ' + error.message});
    }
});

// Роут для добавления сотрудника в бригаду
router.post('/:id/add-member', async function(req, res) {
    let team_id = parseInt(req.params.id);
    let member = req.body;
    
    console.log('Adding member to team:', { team_id, member });
    
    if (isNaN(team_id)) {
        return res.send({msg: 'Неверный ID бригады'});
    }

    try {
        // Получаем id пользователя-клинера
        const cleanerUserId = parseInt(member.user_id);
        
        if (isNaN(cleanerUserId)) {
            return res.send({msg: 'Неверный ID пользователя'});
        }

        // Проверяем, что выбранный пользователь имеет роль Клинер
        const userCheck = await req.db.oneOrNone(`
            SELECT id, id_role FROM users WHERE id = $1
        `, [cleanerUserId]);
        
        console.log('User check:', userCheck);
        
        if (!userCheck) {
            return res.send({msg: 'Пользователь не найден'});
        }
        
        if (userCheck.id_role !== 'Клинер') {
            return res.send({msg: 'Выбранный пользователь не имеет роль "Клинер"'});
        }

        // Получаем id сотрудника по id пользователя
        const employee = await req.db.oneOrNone(`
            SELECT id FROM employees WHERE id_pol = $1
        `, [cleanerUserId]);
        
        console.log('Employee found:', employee);
        
        if (!employee) {
            return res.send({msg: 'Для выбранного пользователя не создан профиль сотрудника'});
        }

        // Проверяем, не состоит ли уже сотрудник в этой бригаде
        const exists = await req.db.oneOrNone(
            'SELECT id FROM team_items WHERE id_team = $1 AND id_employee = $2',
            [team_id, employee.id]
        );
        
        if (exists) {
            return res.send({msg: 'Сотрудник уже состоит в этой бригаде'});
        }

        // Проверяем, не состоит ли сотрудник в другой бригаде
        const inOtherTeam = await req.db.oneOrNone(
            'SELECT id_team FROM team_items WHERE id_employee = $1',
            [employee.id]
        );
        
        if (inOtherTeam) {
            return res.send({msg: 'Сотрудник уже состоит в другой бригаде'});
        }

        // Создаем запись в таблице team_items
        const result = await req.db.none(
            'INSERT INTO team_items(id_team, id_employee) VALUES($1, $2)',
            [team_id, employee.id]
        );
        
        console.log('Member added successfully:', { team_id, employee_id: employee.id });
        res.send({msg: ''});
    } catch (error) {
        console.error('Add member error:', error);
        res.send({msg: 'Ошибка при добавлении сотрудника: ' + error.message});
    }
});

module.exports = router;