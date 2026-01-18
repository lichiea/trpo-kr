var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    let users = await req.db.any(`
        SELECT
            users.id AS id,
            users.login AS login,
            users.id_role AS id_role
        FROM
            users
    `)
    console.log(users)
    res.json({users: users })

});

module.exports = router;