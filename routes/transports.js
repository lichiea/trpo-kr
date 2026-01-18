var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_transports = user && user.id_role == 'Администратор' ? true : false

    let transports = await req.db.any(`
        SELECT
            transports.id AS id,
            transports.model AS model
        FROM
            transports
    `)
    console.log(transports)
    res.render('transports/list', { title: 'Транспорт ', transports: transports, can_view_transports: can_view_transports })

});

router.post('/create', async function(req, res, next) {
    let transport = req.body
    await req.db.none('INSERT INTO transports(model) VALUES(${model})', transport);
    res.send({msg: ''})
});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid transport ID');

    var user = session.auth(req).user
    var can_view_transports = user && user.id_role == 'Администратор' ? true : false

    let transport = await req.db.one(`
        SELECT
            transports.id AS id,
            transports.model AS model
        FROM
            transports
        WHERE
            transports.id = ${id}
    `)


    res.render('transports/view', { title: 'Транспорт '+ "   " + transport.id, transport: transport, can_view_transports: can_view_transports })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let transport = req.body;
    try {
        await req.db.none(`
            UPDATE transports 
            SET 
                model = '${transport.model}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении данных транспорта'});
    }
});


module.exports = router;
