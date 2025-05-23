$(document).ready(function(){

    $('#create_payments').click(function(e){

        $('#create_payments_popup').show()

    })

    $('#create_payments_popup_close').click(function(e){

        $('#create_payments_popup').hide()

    })

    $('#cancel_create_payments').click(function(e){

        $('#create_payments_popup').hide()

    })

    $('#submit_create_payments').click(function(e){

        e.preventDefault()
        let data = {
            id_order: $('#inpOrder').val(),
            id_payment_type: $('#inpPT').val(),
            amount: $('#inpAmount').val(),
        }

        $.ajax({
            type: 'POST',
            data: data,
            url: '/payments/create',
            dataType: 'JSON'
        }).done(function( response ) {

            if (response.msg === '') {
                alert('Платеж создан')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        });

    })


});

