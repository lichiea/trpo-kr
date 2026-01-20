$(document).ready(function(){

    $('#create_user').click(function(e){
        $('#create_user_popup').show()
    })

    $('#create_user_popup_close').click(function(e){
        $('#create_user_popup').hide()
    })

    $('#cancel_create_user').click(function(e){
        $('#create_user_popup').hide()
    })

    $('#submit_create_user').click(function(e){
        e.preventDefault()

        // Правильные ID полей из list.pug
        let data = {
            login: $('#inplogin').val(),
            pass: $('#inppass').val(),
            id_role: $('#inpid_role').val()
        };

        // Валидация
        if (!data.login || !data.pass || !data.id_role) {
            alert('Пожалуйста, заполните все обязательные поля (логин, пароль и роль)');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/users/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Пользователь создан')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании пользователя: ' + error);
        });
    });

    // Обработка редактирования пользователя (для view.pug)
    $('#editSaveButton').click(function(e){
        e.preventDefault()
        
        // Собираем данные формы
        let data = {
            login: $('#editlogin').val(),
            pass: $('#editpass').val(), // Может быть пустым
            id_role: $('#editid_role').val()
        };

        // Валидация
        if (!data.login || !data.id_role) {
            alert('Пожалуйста, заполните обязательные поля (логин и роль)');
            return;
        }

        // Получаем ID пользователя из URL
        const pathSegments = window.location.pathname.split('/');
        const userId = pathSegments[pathSegments.length - 1];

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/users/update/' + userId,
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Данные пользователя успешно обновлены')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при обновлении пользователя: ' + error);
        });
    });

    // Обработка удаления пользователя (для view.pug)
    $('#confirmDelete').click(function(e){
        e.preventDefault()
        
        // Получаем ID пользователя из URL
        const pathSegments = window.location.pathname.split('/');
        const userId = pathSegments[pathSegments.length - 1];

        $.ajax({
            type: 'DELETE',
            contentType: 'application/json',
            url: '/users/delete/' + userId,
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Пользователь успешно удалён')
                window.location.href = '/users'
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при удалении пользователя: ' + error);
        });
    });

});