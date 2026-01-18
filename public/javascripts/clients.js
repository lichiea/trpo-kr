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
            fio:    $('#inpName').val(),
        }

        $.ajax({
            type: 'POST',
            data: data,
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
        });

    })


    $('#update_client').click(function(e){
        e.preventDefault();
   
        const pathSegments = window.location.pathname.split('/');
        const clientId = pathSegments[pathSegments.length - 1];   

        let data = {
            fio: $('#editLabel').val(),
        };

        $.ajax({
            type: 'POST',
            data: data,
            url: `/clients/update/${clientId}`,
            dataType: 'JSON'
        }).done(function(response) {
            if (response.msg === '') {
                alert('Запись о клиенте обновлена');
                window.location.href = '/clients';
            } else {
                alert(response.msg);
            }
        });
    });





});
