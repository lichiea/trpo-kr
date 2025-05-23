$(document).ready(function(){

    $('#create_order').click(function(e){

        $('#create_order_popup').show()

    })

    $('#create_order_popup_close').click(function(e){

        $('#create_order_popup').hide()

    })

    $('#cancel_create_order').click(function(e){

        $('#create_order_popup').hide()

    })

    $('#submit_create_order').click(function(e){

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
            url: '/orders/create',
            dataType: 'JSON'
        }).done(function( response ) {

            if (response.msg === '') {
                alert('Заказ создан')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        });

    })


    $('#update_order').click(function(e){
        e.preventDefault();
   
        const pathSegments = window.location.pathname.split('/');
        const orderId = pathSegments[pathSegments.length - 1];   

        let data = {
            label: $('#editLabel').val(),
            id_client: $('#editClient').val(),
            id_status: $('#status-select').val(),
            amount: $('#editAmount').val(),
        };

        $.ajax({
            type: 'POST',
            data: data,
            url: `/orders/update/${orderId}`,
            dataType: 'JSON'
        }).done(function(response) {
            if (response.msg === '') {
                alert('Заказ обновлен');
                window.location.href = '/orders';
            } else {
                alert(response.msg);
            }
        });
    });





});

