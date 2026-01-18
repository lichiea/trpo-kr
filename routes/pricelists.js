var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_pricelists = user && user.id_role == 'Администратор' ? true : false

    let pricelists = await req.db.any(`
        SELECT
            pricelists.id AS id,
            pricelists.label AS label
        FROM
            pricelists
    `)
    console.log(pricelists)
    res.render('pricelists/list', { title: 'Прейскурант ', pricelists: pricelists, can_view_pricelists: can_view_pricelists })

});

router.post('/create', async function(req, res, next) {
    let pricelist = req.body
    await req.db.none('INSERT INTO pricelists(label) VALUES(${label})', pricelist);
    res.send({msg: ''})
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid pricelist ID');

    var user = session.auth(req).user
    var can_view_pricelists = user && user.id_role == 'Администратор' ? true : false

    let pricelist = await req.db.one(`
        SELECT
            pricelists.id AS id,
            pricelists.label AS label
        FROM
            pricelists
        WHERE
            pricelists.id = ${id}
    `)


    res.render('pricelists/view', { title: 'Прейскурант '+ "   " + pricelist.id, pricelist: pricelist, can_view_pricelists: can_view_pricelists })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let pricelist = req.body;
    try {
        await req.db.none(`
            UPDATE pricelists 
            SET 
                label = '${pricelist.label}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении данных прейскуранта'});
    }
});


module.exports = router;
