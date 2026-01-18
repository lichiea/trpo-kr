var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_services = user && user.id_role && user.id_role <= 2 ? true : false

    let services = await req.db.any(`
        SELECT
            services.id AS id,
            services.label AS label,
            services.description AS description
        FROM
            services
        ORDER BY services.id
    `)
    
    res.render('services/list', { 
        title: 'Услуги', 
        services: services, 
        can_view_services: can_view_services 
    })

});

router.post('/create', async function(req, res, next) {
    let service = req.body
    await req.db.none('INSERT INTO services(label, description) VALUES(${label}, ${description})', service);
    res.send({msg: ''})

});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid service ID');

    var user = session.auth(req).user
    var can_view_services = user && user.id_role && user.id_role <= 2 ? true : false

    let service = await req.db.one(`
        SELECT
            services.id AS id,
            services.label AS label,
            services.description AS description
        FROM
            services
        WHERE
            services.id = ${id}
    `)

    res.render('services/view', { 
        title: service.label, 
        service: service, 
        can_view_services: can_view_services 
    })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let service = req.body;

    try {
        await req.db.none(`
            UPDATE services 
            SET 
                label = '${service.label}',
                description = '${service.description}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении услуги'});
    }
});


module.exports = router;