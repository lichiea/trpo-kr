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
            id_order: $('#inpid_order').val(),
            type_doc: $('#inptype_doc').val(),
            creationDate: $('#inpcreationDate').val(),
            filePath: $('#inpfilePath').val()
        };

        // Валидация
        if (!data.id_order || !data.type_doc || !data.creationDate) {
            alert('Пожалуйста, заполните обязательные поля (ID заказа, тип документа и дата создания)');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
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
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании документа: ' + error);
        });
    });

});