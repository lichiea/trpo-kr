$(document).ready(function(){

    $('#create_doc').click(function(e){

        $('#create_doc_popup').show()

    })

    $('#create_doc_popup_close').click(function(e){

        $('#create_doc_popup').hide()

    })

    $('#cancel_create_doc').click(function(e){

        $('#create_doc_popup').hide()

    })

    $('#submit_create_doc').click(function(e){

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
            url: '/docs/create',
            dataType: 'JSON'
        }).done(function( response ) {

            if (response.msg === '') {
                alert('Документ создан')
                window.location.reload()
            }
            else {
                alert(response.msg)
            }
        });

    })


    $('#update_doc').click(function(e){
        e.preventDefault();
   
        const pathSegments = window.location.pathname.split('/');
        const docId = pathSegments[pathSegments.length - 1];   

        let data = {
            label: $('#editLabel').val(),
            id_client: $('#editClient').val(),
            id_status: $('#status-select').val(),
            amount: $('#editAmount').val(),
        };

        $.ajax({
            type: 'POST',
            data: data,
            url: `/docs/update/${docId}`,
            dataType: 'JSON'
        }).done(function(response) {
            if (response.msg === '') {
                alert('Документ обновлен');
                window.location.href = '/docs';
            } else {
                alert(response.msg);
            }
        });
    });
});

