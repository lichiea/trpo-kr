var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_users = user && user.id_role == 'Администратор' ? true : false

    let users = await req.db.any(`
        SELECT
            users.id AS id,
            users.login AS login,
            users.pass AS pass,
            users.id_role AS id_role
        FROM
            users
    `)
    console.log(users)
    res.render('users/list', { title: 'Пользователи', users: users, can_view_users: can_view_users })
});

router.post('/create', async function(req, res, next) {
    let user = req.body
    await req.db.none('INSERT INTO users(login, pass, id_role) VALUES(${login}, ${pass}, ${id_role})', user);
    res.send({msg: ''})

});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid user ID');

    var user = session.auth(req).user
    var can_view_users = user && user.id_role == 'Администратор' ? true : false

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
    `)

    res.render('users/view', { title: 'Пользователь ' + userData.login, user: userData, can_view_users: can_view_users })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let user = req.body;

    try {
        await req.db.none(`
            UPDATE users 
            SET 
                login = '${user.login}',
                pass = '${user.pass}',
                id_role = '${user.id_role}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении пользователя'});
    }
});

module.exports = router;
