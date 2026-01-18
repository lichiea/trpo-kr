var express = require('express');
var router = express.Router();

router.get('/', async function(req, res, next) {

    var user = session.auth(req).user
    var can_view_docs = user && user.id_role == 'Администратор' ? true : false

    let docs = await req.db.any(`
        SELECT
            docs.id AS id,
            docs.filePath AS filePath
        FROM
            docs
    `)
    console.log(docs)
    res.render('docs/list', { title: 'Документы', docs: docs, can_view_docs: can_view_docs })

});

router.post('/create', async function(req, res, next) {
    let doc = req.body
    await req.db.none('INSERT INTO docs(filePath) VALUES(${filePath})', doc);
    res.send({msg: ''})

});

router.get('/:id', async function(req, res) {
    let id = parseInt(req.params.id);
    if (isNaN(id))
       return res.status(400).send('Invalid doc ID');

    var user = session.auth(req).user
    var can_view_docs = user && user.id_role == 'Администратор' ? true : false

    let doc = await req.db.one(`
        SELECT
            docs.id AS id,
            docs.filePath AS filePath
        FROM
            docs
        WHERE
            docs.id = ${id}
    `)


    res.render('docs/view', { title: 'Документ'+ "   " + doc.id, doc: doc, can_view_docs: can_view_docs })

});


router.post('/update/:id', async function(req, res) {
    let id = req.params.id;
    let doc = req.body;

    try {
        await req.db.none(`
            UPDATE docs 
            SET 
                filePath = '${doc.filePath}'
            WHERE id = ${id}
        `);
        
        res.send({msg: ''});
    } catch (error) {
        console.error(error);
        res.send({msg: 'Ошибка при обновлении документа'});
    }
});


module.exports = router;
