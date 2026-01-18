var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_equipments = user && user.id_role == 'Администратор' ? true : false

    let equipments = await req.db.any(`
        SELECT
            equipments.id AS id,
            equipments.label AS label
        FROM
            equipments
    `)
    console.log(equipments)
    res.render('equipments/list', { title: 'Инвентарь ', equipments: equipments, can_view_equipments: can_view_equipments })

});

router.post('/create', async function(req, res, next) {
    let equipment = req.body
    await req.db.none('INSERT INTO equipments(label) VALUES(${label})', equipment);
    res.send({msg: ''})
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid equipment ID');

    var user = session.auth(req).user
    var can_view_equipments = user && user.id_role == 'Администратор' ? true : false

    let equipment = await req.db.one(`
        SELECT
            equipments.id AS id,
            equipments.label AS label
        FROM
            equipments
        WHERE
            equipments.id = ${id}
    `)


    res.render('equipments/view', { title: 'Инвентарь '+ "   " + equipment.id, equipment: equipment, can_view_equipments: can_view_equipments })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let equipment = req.body;
    try {
        await req.db.none(`
            UPDATE equipments 
            SET 
                label = '${equipment.label}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении данных инвентаря'});
    }
});


module.exports = router;
