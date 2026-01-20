$(document).ready(function(){

    $('#create_equipment').click(function(e){
        $('#create_equipment_popup').show();
    });

    $('#create_equipment_popup_close').click(function(e){
        $('#create_equipment_popup').hide();
        clearForm();
    });

    $('#cancel_create_equipment').click(function(e){
        $('#create_equipment_popup').hide();
        clearForm();
    });

    // Обработчик для кнопки создания инвентаря
    $('#submit_create_equipment').off('click').click(function(e){
        e.preventDefault();
        console.log('Create equipment button clicked');
        
        let data = {
            label: $('#inplabel').val().trim(),
            description: $('#inpdescription').val().trim()
        };

        // Валидация
        if (!data.label) {
            alert('Пожалуйста, заполните наименование инвентаря');
            return;
        }

        // Блокируем кнопку от повторных нажатий
        const $btn = $(this);
        $btn.prop('disabled', true).text('Создание...');

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/equipments/create',
            dataType: 'JSON'
        }).done(function( response ) {
            console.log('Response:', response);
            if (response.msg === '') {
                alert('Запись об инвентаре создана');
                window.location.reload();
            }
            else {
                alert(response.msg);
                $btn.prop('disabled', false).text('Создать');
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error, 'Status:', status);
            alert('Ошибка при создании инвентаря: ' + error);
            $btn.prop('disabled', false).text('Создать');
        });
    });
    
    // Функция очистки формы
    function clearForm() {
        $('#inplabel').val('');
        $('#inpdescription').val('');
        $('#submit_create_equipment').prop('disabled', false).text('Создать');
    }
    
    // Закрытие модального окна при клике вне его
    $(window).click(function(event) {
        if ($(event.target).is('#create_equipment_popup')) {
            $('#create_equipment_popup').hide();
            clearForm();
        }
    });
});