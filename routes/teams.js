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
        await req.db.none(
            'INSERT INTO teams(id_taskmaster) VALUES(${id_taskmaster})', 
            team
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
        let team = await req.db.one(`
            SELECT
                teams.id AS id,
                teams.id_taskmaster AS id_taskmaster,
                taskmaster.fio AS taskmaster_fio,
                taskmaster.position_d AS taskmaster_position
            FROM
                teams
            LEFT JOIN employees AS taskmaster ON teams.id_taskmaster = taskmaster.id
            WHERE
                teams.id = ${id}
        `)

        // Получаем членов бригады
        let team_members = await req.db.any(`
            SELECT
                team_items.id AS item_id,
                employees.id AS employee_id,
                employees.fio AS employee_fio,
                employees.position_d AS employee_position
            FROM
                team_items
            LEFT JOIN employees ON team_items.id_employee = employees.id
            WHERE
                team_items.id_team = ${id}
        `)

        // Получаем список всех сотрудников для выпадающего списка
        let all_employees = await req.db.any(`
            SELECT id, fio, position_d 
            FROM employees 
            ORDER BY fio
        `)

        res.render('teams/view', { 
            title: 'Бригада №' + team.id, 
            team: team, 
            team_members: team_members,
            all_employees: all_employees,
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
        await req.db.none(`
            UPDATE teams 
            SET 
                id_taskmaster = $1
            WHERE id = $2
        `, [
            team.id_taskmaster,
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
        // Проверяем, не состоит ли уже сотрудник в бригаде
        const exists = await req.db.oneOrNone(
            'SELECT id FROM team_items WHERE id_team = $1 AND id_employee = $2',
            [team_id, member.id_employee]
        );
        
        if (exists) {
            return res.send({msg: 'Сотрудник уже состоит в этой бригаде'});
        }

        await req.db.none(
            'INSERT INTO team_items(id_team, id_employee) VALUES($1, $2)',
            [team_id, member.id_employee]
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

module.exports = router;