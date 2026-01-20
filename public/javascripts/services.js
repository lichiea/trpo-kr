$(document).ready(function(){

    // Открытие модального окна (если есть кнопка в DOM)
    $(document).on('click', '#create_service, #create_service_empty', function(e){
        e.preventDefault();
        $('#create_service_popup').show();
        $('body').css('overflow', 'hidden');
    });

    // Закрытие модального окна
    $(document).on('click', '#create_service_popup_close, #cancel_create_service', function(e){
        e.preventDefault();
        $('#create_service_popup').hide();
        $('body').css('overflow', 'auto');
        clearForm();
    });

    // Закрытие при клике вне окна
    $(window).click(function(e){
        if (e.target.id === 'create_service_popup') {
            $('#create_service_popup').hide();
            $('body').css('overflow', 'auto');
            clearForm();
        }
    });

    // Создание услуги
    $(document).on('click', '#submit_create_service', function(e){
        e.preventDefault();

        let data = {
            label: $('#inplabel').val(),
            description: $('#inpdescription').val(),
            id_equip: $('#inpid_equip').val()
        };

        // Валидация
        if (!data.label) {
            alert('Пожалуйста, заполните название услуги');
            return;
        }

        // Преобразуем id_equip в число
        if (data.id_equip && data.id_equip !== '') {
            data.id_equip = parseInt(data.id_equip);
            if (isNaN(data.id_equip)) {
                alert('Ошибка выбора оборудования');
                return;
            }
        } else {
            data.id_equip = null;
        }

        // Показываем индикатор загрузки
        $('#submit_create_service').prop('disabled', true).html('<span class="loading-spinner"></span> Создание...');

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/services/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Услуга создана');
                window.location.reload();
            }
            else {
                alert(response.msg);
                $('#submit_create_service').prop('disabled', false).text('Создать');
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании услуги: ' + error);
            $('#submit_create_service').prop('disabled', false).text('Создать');
        });
    });

    // Функция очистки формы
    function clearForm() {
        $('#inplabel').val('');
        $('#inpdescription').val('');
        $('#inpid_equip').val('');
    }

});