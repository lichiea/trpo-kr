var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_employees = user && user.id_role ? true : false

    let employees = await req.db.any(`
        SELECT
            employees.id AS id,
            employees.fio AS fio,
            employees.phone AS phone,
            employees.email AS email,
            employees.position_d AS position_d,
            employees.specialization AS specialization,
            employees.id_pol AS id_pol
        FROM
            employees
    `)
    console.log(employees)
    res.render('employees/list', { title: 'Сотрудники', employees: employees, can_view_employees: can_view_employees })

});

router.post('/create', async function(req, res, next) {
    let employee = req.body;
    
    // Валидация
    if (!employee.fio || !employee.phone || !employee.position_d) {
        return res.send({msg: 'Обязательные поля: ФИО, телефон и должность'});
    }

    try {
        await req.db.none(
            'INSERT INTO employees(fio, phone, email, position_d, specialization) VALUES(${fio}, ${phone}, ${email}, ${position_d}, ${specialization})', 
            employee
        );
        res.send({msg: ''});
    } catch (error) {
        console.error('Create error:', error);
        res.send({msg: 'Ошибка при создании сотрудника: ' + error.message});
    }
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid employee ID');

    var user = session.auth(req).user
    var can_view_employees = user && user.id_role ? true : false

    try {
        // Получаем данные сотрудника
        let employee = await req.db.one(`
            SELECT
                employees.id AS id,
                employees.fio AS fio,
                employees.phone AS phone,
                employees.email AS email,
                employees.position_d AS position_d,
                employees.specialization AS specialization,
                employees.id_pol AS id_pol
            FROM
                employees
            WHERE
                employees.id = ${id}
        `)

        // Получаем данные пользователя (логин и роль) из таблицы users
        let userData = await req.db.oneOrNone(`
            SELECT
                users.id AS user_id,
                users.login AS login,
                users.id_role AS role
            FROM
                users
            WHERE
                users.id = ${employee.id_pol}
        `)

        // Получаем номер бригады из таблицы team_items
        let teamInfo = await req.db.oneOrNone(`
            SELECT
                team_items.id_team AS team_id,
                teams.id_taskmaster AS team_leader_id
            FROM
                team_items
            LEFT JOIN teams ON team_items.id_team = teams.id
            WHERE
                team_items.id_employee = ${id}
            LIMIT 1
        `)

        // Получаем информацию о бригадире, если сотрудник не бригадир
        let teamLeaderInfo = null;
        if (teamInfo && teamInfo.team_leader_id) {
            teamLeaderInfo = await req.db.oneOrNone(`
                SELECT
                    employees.fio AS team_leader_fio,
                    employees.position_d AS team_leader_position
                FROM
                    employees
                WHERE
                    employees.id = ${teamInfo.team_leader_id}
            `)
        }

        // Проверяем, является ли сотрудник бригадиром
        let isTeamLeader = await req.db.oneOrNone(`
            SELECT
                teams.id AS team_id
            FROM
                teams
            WHERE
                teams.id_taskmaster = ${id}
            LIMIT 1
        `)

        res.render('employees/view', { 
            title: 'Сотрудник: ' + employee.fio, 
            employee: employee, 
            userData: userData,
            teamInfo: teamInfo,
            teamLeaderInfo: teamLeaderInfo,
            isTeamLeader: isTeamLeader,
            can_view_employees: can_view_employees 
        })

    } catch (error) {
        console.error('Error fetching employee details:', error);
        res.status(500).send('Ошибка сервера: ' + error.message);
    }

});


// Роут для обновления сотрудника
router.post('/update/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    let employee = req.body;
    
    console.log('Update request for employee ID:', id);
    console.log('Data received:', employee);

    // Валидация
    if (!employee.fio || !employee.phone || !employee.position_d) {
        return res.send({msg: 'Обязательные поля: ФИО, телефон и должность'});
    }

    try {
        // Используйте параметризованный запрос
        await req.db.none(`
            UPDATE employees 
            SET 
                fio = $1,
                phone = $2,
                email = $3,
                position_d = $4,
                specialization = $5,
                id_pol = $6
            WHERE id = $7
        `, [
            employee.fio,
            employee.phone,
            employee.email || null,
            employee.position_d,
            employee.specialization || null,
            employee.id_pol || null,
            id
        ]);
        
        console.log('Employee updated successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Update error:', error);
        res.send({msg: 'Ошибка при обновлении сотрудника: ' + error.message});
    }
});

// Роут для удаления сотрудника
router.delete('/delete/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    
    console.log('Delete request for employee ID:', id);
    
    if (isNaN(id)) {
        return res.send({msg: 'Неверный ID сотрудника'});
    }
    
    try {
        // Проверяем, существует ли сотрудник
        const employeeExists = await req.db.oneOrNone(
            'SELECT id FROM employees WHERE id = $1',
            [id]
        );
        
        if (!employeeExists) {
            return res.send({msg: 'Сотрудник не найден'});
        }
        
        // Проверяем, не является ли сотрудник бригадиром
        const isTeamLeader = await req.db.oneOrNone(
            'SELECT id FROM teams WHERE id_taskmaster = $1',
            [id]
        );
        
        if (isTeamLeader) {
            return res.send({msg: 'Невозможно удалить сотрудника, так как он является бригадиром. Сначала назначьте нового бригадира.'});
        }
        
        // Проверяем, не состоит ли сотрудник в бригаде
        const inTeam = await req.db.oneOrNone(
            'SELECT id_employee FROM team_items WHERE id_employee = $1',
            [id]
        );
        
        if (inTeam) {
            return res.send({msg: 'Невозможно удалить сотрудника, так как он состоит в бригаде. Сначала удалите его из бригады.'});
        }
        
        // Удаляем сотрудника
        await req.db.none(
            'DELETE FROM employees WHERE id = $1',
            [id]
        );
        
        console.log('Employee deleted successfully');
        res.send({msg: ''});
    } catch (error) {
        console.error('Delete error:', error);
        res.send({msg: 'Ошибка при удалении сотрудника: ' + error.message});
    }
});

module.exports = router;