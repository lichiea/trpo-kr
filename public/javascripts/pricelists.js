$(document).ready(function(){
    $('#create_pricelist').click(function(e){
        $('#create_pricelist_popup').show();
    });

    $('#create_pricelist_popup_close').click(function(e){
        $('#create_pricelist_popup').hide();
    });

    $('#cancel_create_pricelist').click(function(e){
        $('#create_pricelist_popup').hide();
    });

    $('#submit_create_pricelist').click(function(e){
        e.preventDefault();

        let data = {
            label: $('#inplabel').val(),
            validFrom: $('#inpvalidFrom').val(),
            validTo: $('#inpvalidTo').val() || null,
            isActive: $('#inpisActive').val() === 'true'
        };

        if (!data.label || !data.validFrom) {
            alert('Пожалуйста, заполните обязательные поля (Название и дата начала действия)');
            return;
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/pricelists/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Прейскурант создан');
                window.location.reload();
            }
            else {
                alert(response.msg);
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании прейскуранта: ' + error);
        });
    });
});