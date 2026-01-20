$(document).ready(function(){

    $('#create_equipment').click(function(e){
        $('#create_equipment_popup').show()
    })

    $('#create_equipment_popup_close').click(function(e){
        $('#create_equipment_popup').hide()
    })

    $('#cancel_create_equipment').click(function(e){
        $('#create_equipment_popup').hide()
    })

    $('#submit_create_equipment').click(function(e){
        e.preventDefault()

        let data = {
            label: $('#inplabel').val(),
            description: $('#inpdescription').val()
        };

        // Валидация
        if (!data.label) {
            alert('Пожалуйста, заполните наименование оборудования');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/equipments/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Запись об оборудовании создана')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании оборудования: ' + error);
        });
    });

});