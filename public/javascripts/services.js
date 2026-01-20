$(document).ready(function(){

    $('#create_service').click(function(e){
        $('#create_service_popup').show()
    })

    $('#create_service_popup_close').click(function(e){
        $('#create_service_popup').hide()
    })

    $('#cancel_create_service').click(function(e){
        $('#create_service_popup').hide()
    })

    $('#submit_create_service').click(function(e){
        e.preventDefault()

        let data = {
            label: $('#inplabel').val(),
            description: $('#inpdescription').val(),
            id_equip: $('#inpid_equip').val()
        };

        // Валидация
        if (!data.label) {
            alert('Пожалуйста, заполните название услуги');
            return;
        }

        // Преобразуем id_equip в число
        if (data.id_equip && data.id_equip !== '') {
            data.id_equip = parseInt(data.id_equip);
            if (isNaN(data.id_equip)) {
                alert('ID оборудования должно быть числом');
                return;
            }
        } else {
            data.id_equip = null;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/services/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Услуга создана')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании услуги: ' + error);
        });
    });

});