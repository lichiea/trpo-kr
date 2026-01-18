var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_teams = user && user.id_role == 'Администратор' ? true : false

    let teams = await req.db.any(`
        SELECT
            teams.id AS id,
        FROM
            teams
    `)
    console.log(teams)
    res.render('teams/list', { title: 'Бригада ', teams: teams, can_view_teams: can_view_teams })

});

//router.post('/create', async function(req, res, next) {
//    let team = req.body
//    await req.db.none('INSERT INTO teams(label) VALUES(${label})', team);
//    res.send({msg: ''})
//});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid team ID');

    var user = session.auth(req).user
    var can_view_teams = user && user.id_role == 'Администратор' ? true : false

    let team = await req.db.one(`
        SELECT
            teams.id AS id,
        FROM
            teams
        WHERE
            teams.id = ${id}
    `)


    res.render('teams/view', { title: 'Бригада '+ "   " + team.id, team: team, can_view_teams: can_view_teams })

});


// router.post('/update/:id', async function(req, res) {
//     let id = req.params.id;
//     let team = req.body;
//     try {
//         await req.db.none(`
//             UPDATE teams 
//             SET 
//                 label = '${team.label}'
//             WHERE id = ${id}
//         `);
        
//         res.send({msg: ''});
//     } catch (error) {
//         console.error(error);
//         res.send({msg: 'Ошибка при обновлении данных бригады'});
//     }
// });


module.exports = router;
