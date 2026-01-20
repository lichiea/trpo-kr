$(document).ready(function(){

    $('#create_team').click(function(e){
        $('#create_team_popup').show()
    })

    $('#create_team_popup_close').click(function(e){
        $('#create_team_popup').hide()
    })

    $('#cancel_create_team').click(function(e){
        $('#create_team_popup').hide()
    })

    $('#submit_create_team').click(function(e){
        e.preventDefault()

        let data = {
            id_taskmaster: $('#inpTaskmaster').val()
        };

        // Валидация
        if (!data.id_taskmaster) {
            alert('Пожалуйста, выберите бригадира');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/teams/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Бригада создана')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании бригады: ' + error);
        });
    });

});