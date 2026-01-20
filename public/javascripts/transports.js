$(document).ready(function(){
    $('#create_transport').click(function(e){
        $('#create_transport_popup').show()
    })

    $('#create_transport_popup_close').click(function(e){
        $('#create_transport_popup').hide()
    })

    $('#cancel_create_transport').click(function(e){
        $('#create_transport_popup').hide()
    })

    $('#submit_create_transport').click(function(e){
        e.preventDefault()

        let data = {
            model: $('#inpmodel').val(),
            registrationNumber: $('#inpregistrationNumber').val()
        };

        // Валидация
        if (!data.model || !data.registrationNumber) {
            alert('Пожалуйста, заполните обязательные поля (модель и регистрационный номер)');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/transports/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Транспортное средство создано')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании транспортного средства: ' + error);
        });
    });
});