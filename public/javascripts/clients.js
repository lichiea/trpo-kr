$(document).ready(function(){

    let isSubmitting = false; // Защита от двойного нажатия

    $('#create_client').click(function(e){
        $('#create_client_popup').show();
    });

    $('#create_client_popup_close').click(function(e){
        $('#create_client_popup').hide();
        clearForm();
    });

    $('#cancel_create_client').click(function(e){
        $('#create_client_popup').hide();
        clearForm();
    });

    function clearForm() {
        $('#inpfio').val('');
        $('#inpphone').val('');
        $('#inpemail').val('');
        $('#inptype_l').val('');
        $('#inplogin').val('');
        $('#inppass').val('');
    }

    $('#submit_create_client').off('click').on('click', function(e){
        e.preventDefault();

        // Защита от двойного нажатия
        if (isSubmitting) {
            return;
        }
        isSubmitting = true;

        let data = {
            fio: $('#inpfio').val(),
            phone: $('#inpphone').val(),
            email: $('#inpemail').val(),
            type_l: $('#inptype_l').val(),
            login: $('#inplogin').val(),
            pass: $('#inppass').val()
        };

        console.log('Sending data:', data);

        // Проверяем, заполнены ли логин и пароль
        const createWithUser = data.login && data.pass;

        // Валидация для создания с пользователем
        if (createWithUser) {
            if (!data.fio || !data.phone || !data.type_l || !data.login || !data.pass) {
                alert('Пожалуйста, заполните все обязательные поля (ФИО, телефон, тип лица, логин и пароль)');
                isSubmitting = false;
                return;
            }
        } else {
            // Валидация для создания только клиента
            if (!data.fio || !data.phone || !data.type_l) {
                alert('Пожалуйста, заполните обязательные поля (ФИО, телефон и тип лица)');
                isSubmitting = false;
                return;
            }
        }

        // Проверка типа лица
        if (!['Физическое лицо', 'Юридическое лицо'].includes(data.type_l)) {
            alert('Тип лица должен быть "Физическое лицо" или "Юридическое лицо"');
            isSubmitting = false;
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/clients/create',
            dataType: 'JSON'
        }).done(function( response ) {
            isSubmitting = false;
            if (response.msg === '') {
                if (createWithUser) {
                    alert('Клиент и пользователь успешно созданы');
                } else {
                    alert('Клиент успешно создан');
                }
                window.location.reload();
            }
            else {
                alert(response.msg);
            }
        }).fail(function(xhr, status, error) {
            isSubmitting = false;
            console.error('Error:', error);
            alert('Ошибка при создании клиента: ' + error);
        });
    });

});