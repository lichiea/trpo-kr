$(document).ready(function(){

    $('#create_services').click(function(e){

        $('#create_services_popup').show()

    })

    $('#create_services_popup_close').click(function(e){

        $('#create_services_popup').hide()

    })

    $('#cancel_create_services').click(function(e){

        $('#create_services_popup').hide()

    })

    $('#submit_create_services').click(function(e){

        e.preventDefault()
        let data = {
            label: $('#inpService').val(),
            description: $('#inpDesc').val(),
        }

        $.ajax({
            type: 'POST',
            data: data,
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
        });

    })


});

