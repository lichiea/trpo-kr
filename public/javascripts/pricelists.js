$(document).ready(function(){

    $('#create_pricelist').click(function(e){

        $('#create_pricelist_popup').show()

    })

    $('#create_pricelist_popup_close').click(function(e){

        $('#create_pricelist_popup').hide()

    })

    $('#cancel_create_pricelist').click(function(e){

        $('#create_pricelist_popup').hide()

    })

    $('#submit_create_pricelist').click(function(e){

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
            url: '/pricelists/create',
            dataType: 'JSON'
        }).done(function( response ) {

            if (response.msg === '') {
                alert('Прейскурант создан')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        });

    })


    $('#update_pricelist').click(function(e){
        e.preventDefault();
   
        const pathSegments = window.location.pathname.split('/');
        const pricelistId = pathSegments[pathSegments.length - 1];   

        let data = {
            label: $('#editLabel').val(),
            id_client: $('#editClient').val(),
            id_status: $('#status-select').val(),
            amount: $('#editAmount').val(),
        };

        $.ajax({
            type: 'POST',
            data: data,
            url: `/pricelists/update/${pricelistId}`,
            dataType: 'JSON'
        }).done(function(response) {
            if (response.msg === '') {
                alert('Прейскурант обновлен');
                window.location.href = '/pricelists';
            } else {
                alert(response.msg);
            }
        });
    });
});

