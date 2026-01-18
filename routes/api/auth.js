var express = require('express');
var router = express.Router();

router.post('/login', async function(req, res) {
    console.log('Login attempt for:', req.body.login)
    try {
        var cookie = await session.login(req, req.body.login, req.body.password)
        console.log('Cookie result:', cookie ? cookie : 'No cookie (login failed)')
	    if (cookie) {
            res.cookie('app_user', cookie, { maxAge: 43200*1000, httpOnly: true, path: '/' });
            res.json({ msg: ''})
            return;
        }

        console.log('Login failed - returning error')
        res.json({ msg: 'Неверный логин/пароль' })
    } catch(err) {
        console.log('Error in auth/login route:', err)
        res.json({ msg: 'Ошибка сервера при авторизации' })
    }
});


router.post('/logout', function(req, res) {

    var user = session.auth(req)

    if (user) {
        res.clearCookie('app_user', { path: '/' });
        session.logout(user)
    }
	res.json({ msg: '' })

});

module.exports = router;