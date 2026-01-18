$(document).ready(function(){

    $('#create_eqipment').click(function(e){

        $('#create_eqipment_popup').show()

    })

    $('#create_eqipment_popup_close').click(function(e){

        $('#create_eqipment_popup').hide()

    })

    $('#cancel_create_eqipment').click(function(e){

        $('#create_eqipment_popup').hide()

    })

    $('#submit_create_eqipment').click(function(e){

        e.preventDefault()
        let data = {
            label:    $('#inpLabel').val(),
            id_client: $('#inpClient').val(),
            id_status: $('#inpStatus').val(),
            amount: $('#inpAmount').val(),
        }

        $.ajax({
            type: 'POST',
            data: data,
            url: '/eqipments/create',
            dataType: 'JSON'
        }).done(function( response ) {

            if (response.msg === '') {
                alert('Инвентарь создан')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        });

    })


    $('#update_eqipment').click(function(e){
        e.preventDefault();
   
        const pathSegments = window.location.pathname.split('/');
        const eqipmentId = pathSegments[pathSegments.length - 1];   

        let data = {
            label: $('#editLabel').val(),
            id_client: $('#editClient').val(),
            id_status: $('#status-select').val(),
            amount: $('#editAmount').val(),
        };

        $.ajax({
            type: 'POST',
            data: data,
            url: `/eqipments/update/${eqipmentId}`,
            dataType: 'JSON'
        }).done(function(response) {
            if (response.msg === '') {
                alert('Инвентарь обновлен');
                window.location.href = '/eqipments';
            } else {
                alert(response.msg);
            }
        });
    });
});

