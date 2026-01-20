$(document).ready(function(){

    $('#create_client').click(function(e){
        $('#create_client_popup').show()
    })

    $('#create_client_popup_close').click(function(e){
        $('#create_client_popup').hide()
    })

    $('#cancel_create_client').click(function(e){
        $('#create_client_popup').hide()
    })

    $('#submit_create_client').click(function(e){
        e.preventDefault()

        let data = {
            fio: $('#inpfio').val(),
            phone: $('#inpphone').val(),
            email: $('#inpemail').val(),
            type_l: $('#inptype_l').val(),
            id_pol: $('#inpid_pol').val() || null
        };

        // Валидация
        if (!data.fio || !data.phone || !data.type_l) {
            alert('Пожалуйста, заполните обязательные поля (ФИО, телефон и тип лица)');
            return;
        }

        // Проверка типа лица
        if (!['Физическое лицо', 'Юридическое лицо'].includes(data.type_l)) {
            alert('Тип лица должен быть "Физическое лицо" или "Юридическое лицо"');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/clients/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Запись о клиенте создана')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании клиента: ' + error);
        });
    });

});