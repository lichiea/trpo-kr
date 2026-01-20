$(document).ready(function(){

    // Открытие модального окна создания заказа
    $('#create_order').click(function(e){
        $('#create_order_popup').show();
        
        // Загрузка списка клиентов при открытии окна
        // Измените URL для загрузки клиентов
        $.ajax({
            type: 'GET',
            url: '/orders/clients/list',  // Используем новый роут
            dataType: 'JSON'
        }).done(function(response) {
            var clientSelect = $('#inpid_client');
            clientSelect.empty().append('<option value="">Выберите клиента</option>');
    
            $.each(response, function(index, client) {
                clientSelect.append('<option value="' + client.id + '">' + (client.fio || 'Клиент #' + client.id) + '</option>');
            });
    
            // Устанавливаем сегодняшнюю дату по умолчанию
            var today = new Date().toISOString().split('T')[0];
            $('#inpcreationDate').val(today);
    
        }).fail(function(xhr, status, error) {
            console.error('Error loading clients:', error);
        alert('Ошибка загрузки списка клиентов');
        });
    });

    // Закрытие модального окна
    $('#create_order_popup_close').click(function(e){
        $('#create_order_popup').hide();
        clearOrderForm();
    });

    // Отмена создания заказа
    $('#cancel_create_order').click(function(e){
        $('#create_order_popup').hide();
        clearOrderForm();
    });

    // Отправка формы создания заказа
    $('#submit_create_order').click(function(e){
        e.preventDefault();

        // Сбор данных из формы
        let data = {
            id_status: $('#inpstatus').val(),
            creationDate: $('#inpcreationDate').val(),
            id_client: $('#inpid_client').val(),
            totalCost: $('#inptotalCost').val(),
            plannedDate: $('#inpplannedDate').val(),
            description: $('#inpdescription').val()
        };

        // Валидация
        if (!data.id_client || !data.totalCost) {
            alert('Пожалуйста, заполните обязательные поля (клиент и общая стоимость)');
            return;
        }

        // Преобразование totalCost в число
        data.totalCost = parseInt(data.totalCost);
        if (isNaN(data.totalCost) || data.totalCost < 0) {
            alert('Общая стоимость должна быть положительным числом');
            return;
        }

        // Если дата создания не указана, используем текущую
        if (!data.creationDate) {
            var today = new Date();
            data.creationDate = today.toISOString().split('T')[0];
        }

        $.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url: '/orders/create',
            dataType: 'JSON'
        }).done(function( response ) {
            if (response.msg === '') {
                alert('Заказ успешно создан');
                window.location.reload();
            }
            else {
                alert(response.msg);
            }
        }).fail(function(xhr, status, error) {
            console.error('Error:', error);
            alert('Ошибка при создании заказа: ' + error);
        });
    });

    // Функция очистки формы
    function clearOrderForm() {
        $('#inpstatus').val('Новый');
        $('#inpcreationDate').val('');
        $('#inpid_client').val('');
        $('#inptotalCost').val('');
        $('#inpplannedDate').val('');
        $('#inpdescription').val('');
    }

    // Закрытие модального окна при клике вне его
    $(window).click(function(e) {
        if ($(e.target).is('#create_order_popup')) {
            $('#create_order_popup').hide();
            clearOrderForm();
        }
    });

    // Закрытие по клавише ESC
    $(document).keydown(function(e) {
        if (e.key === "Escape" && $('#create_order_popup').is(':visible')) {
            $('#create_order_popup').hide();
            clearOrderForm();
        }
    });

});