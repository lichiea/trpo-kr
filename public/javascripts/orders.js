$(document).ready(function(){
    
    let servicesList = [];
    let clientsList = [];
    let isSubmitting = false;
    let currentObjectSquare = 0;
    
    // Загрузка данных при инициализации
    loadClients();
    loadServices();
    
    // Открытие модального окна создания заказа
    $('#create_order').off('click').on('click', function(e){
        $('#create_order_popup').show();
        var today = new Date().toISOString().split('T')[0];
        $('#inpcreationDate').val(today);
        currentObjectSquare = 0;
    });

    // Закрытие модального окна
    $('#create_order_popup_close').off('click').on('click', function(e){
        $('#create_order_popup').hide();
        clearOrderForm();
    });

    // Отмена создания заказа
    $('#cancel_create_order').off('click').on('click', function(e){
        $('#create_order_popup').hide();
        clearOrderForm();
    });

    // Загрузка клиентов
    function loadClients() {
        $.ajax({
            type: 'GET',
            url: '/orders/clients/list',
            dataType: 'JSON'
        }).done(function(response) {
            clientsList = response;
            updateClientsSelect('#inpclient');
            updateClientsSelect('#object_client');
        }).fail(function(xhr, status, error) {
            console.error('Error loading clients:', error);
            alert('Ошибка загрузки списка клиентов');
        });
    }

    // Обновление селекта клиентов
    function updateClientsSelect(selector) {
        var select = $(selector);
        var currentValue = select.val();
        
        select.empty().append('<option value="">Выберите клиента</option>');
        
        $.each(clientsList, function(index, client) {
            var optionText = client.fio + (client.phone ? ' (' + client.phone + ')' : '');
            select.append('<option value="' + client.id + '">' + optionText + '</option>');
        });
        
        if (currentValue) {
            select.val(currentValue);
        }
    }

    // Загрузка услуг
    function loadServices() {
        $.ajax({
            type: 'GET',
            url: '/orders/services/list',
            dataType: 'JSON'
        }).done(function(response) {
            servicesList = response;
            updateServicesSelects();
        }).fail(function(xhr, status, error) {
            console.error('Error loading services:', error);
            alert('Ошибка загрузки списка услуг');
        });
    }

    // Обновление селектов услуг
    function updateServicesSelects() {
        $('.service-select').each(function() {
            var select = $(this);
            var currentValue = select.val();
            
            select.empty().append('<option value="">Выберите услугу</option>');
            
            $.each(servicesList, function(index, service) {
                select.append('<option value="' + service.id + '">' + service.label + '</option>');
            });
            
            if (currentValue) {
                select.val(currentValue);
            }
        });
    }

    // Загрузка объектов уборки и получение площади
    $(document).off('change', '#inpclient').on('change', '#inpclient', function() {
        var clientId = $(this).val();
        var objectSelect = $('#inpclean_object');
        
        if (clientId) {
            $.ajax({
                type: 'GET',
                url: '/orders/clients/' + clientId + '/objects',
                dataType: 'JSON'
            }).done(function(response) {
                objectSelect.empty().append('<option value="">Выберите объект</option>');
                
                if (response.length === 0) {
                    objectSelect.append('<option value="">У клиента нет объектов</option>');
                } else {
                    $.each(response, function(index, obj) {
                        var optionText = obj.address + ' (' + obj.type_co + ')';
                        if (obj.squaremeterage) {
                            optionText += ' - ' + obj.squaremeterage + ' м²';
                        }
                        objectSelect.append('<option value="' + obj.id + '">' + optionText + '</option>');
                    });
                }
            }).fail(function(xhr, status, error) {
                console.error('Error loading objects:', error);
                objectSelect.empty().append('<option value="">Ошибка загрузки</option>');
            });
        } else {
            objectSelect.empty().append('<option value="">Сначала выберите клиента</option>');
        }
        
        currentObjectSquare = 0;
        updateTotalCost();
    });

    // Загрузка площади объекта при выборе
    $(document).off('change', '#inpclean_object').on('change', '#inpclean_object', function() {
        var objectId = $(this).val();
        
        if (objectId) {
            $.ajax({
                type: 'GET',
                url: '/orders/objects/' + objectId + '/square',
                dataType: 'JSON'
            }).done(function(response) {
                currentObjectSquare = response.square || 0;
                console.log('Object square loaded:', currentObjectSquare);
                updateTotalCost();
                
                if (currentObjectSquare > 0) {
                    $('#square-info').remove();
                    $('<div id="square-info" class="info-message">Площадь объекта: ' + currentObjectSquare + ' м²</div>')
                        .insertAfter('#inpclean_object');
                }
            }).fail(function(xhr, status, error) {
                console.error('Error loading object square:', error);
                currentObjectSquare = 0;
                updateTotalCost();
            });
        } else {
            currentObjectSquare = 0;
            $('#square-info').remove();
            updateTotalCost();
        }
    });

    // Открытие окна создания клиента
    $('#addClientBtn').off('click').on('click', function() {
        $('#create_client_popup').show();
    });

    // Закрытие окна создания клиента
    $('#create_client_popup_close').off('click').on('click', function() {
        $('#create_client_popup').hide();
        clearClientForm();
    });

    // Отмена создания клиента
    $('#cancel_create_client').off('click').on('click', function() {
        $('#create_client_popup').hide();
        clearClientForm();
    });

    // Создание клиента (и пользователя)
    $('#submit_create_client').off('click').on('click', function() {
        var clientData = {
            fio: $('#client_fio').val(),
            phone: $('#client_phone').val(),
            email: $('#client_email').val(),
            type_l: $('#client_type').val(),
            login: $('#client_login').val(),
            password: $('#client_password').val()
        };

        if (!clientData.fio || !clientData.phone || !clientData.login || !clientData.password) {
            alert('Заполните все обязательные поля (ФИО, телефон, логин и пароль)');
            return;
        }

        $(this).prop('disabled', true).text('Создание...');

        $.ajax({
            type: 'POST',
            url: '/orders/clients/create',
            data: JSON.stringify(clientData),
            contentType: 'application/json',
            dataType: 'JSON'
        }).done(function(response) {
            if (response.success) {
                alert(response.message);
                $('#create_client_popup').hide();
                clearClientForm();
                
                loadClients();
                
                if (response.client) {
                    setTimeout(function() {
                        $('#inpclient').val(response.client.id);
                        $('#inpclient').trigger('change');
                    }, 500);
                }
            } else {
                alert('Ошибка: ' + response.error);
            }
        }).fail(function(xhr, status, error) {
            console.error('Error creating client:', error);
            alert('Ошибка создания клиента');
        }).always(function() {
            $('#submit_create_client').prop('disabled', false).text('Создать');
        });
    });

    // Открытие окна создания объекта
    $('#addObjectBtn').off('click').on('click', function() {
        var clientId = $('#inpclient').val();
        if (!clientId) {
            alert('Сначала выберите клиента');
            return;
        }
        
        $('#object_client').val(clientId);
        $('#create_object_popup').show();
    });

    // Закрытие окна создания объекта
    $('#create_object_popup_close').off('click').on('click', function() {
        $('#create_object_popup').hide();
        clearObjectForm();
    });

    // Отмена создания объекта
    $('#cancel_create_object').off('click').on('click', function() {
        $('#create_object_popup').hide();
        clearObjectForm();
    });

    // Создание объекта уборки
    $('#submit_create_object').off('click').on('click', function() {
        var objectData = {
            id_cl: $('#object_client').val(),
            type_co: $('#object_type').val(),
            address: $('#object_address').val(),
            squaremeterage: $('#object_square').val(),
            description: $('#object_description').val()
        };

        if (!objectData.id_cl || !objectData.address) {
            alert('Заполните обязательные поля (клиент и адрес)');
            return;
        }

        $(this).prop('disabled', true).text('Создание...');

        $.ajax({
            type: 'POST',
            url: '/orders/objects/create',
            data: JSON.stringify(objectData),
            contentType: 'application/json',
            dataType: 'JSON'
        }).done(function(response) {
            if (response.success) {
                alert('Объект успешно создан');
                $('#create_object_popup').hide();
                clearObjectForm();
                
                var clientId = $('#inpclient').val();
                $('#inpclient').trigger('change');
                
                setTimeout(function() {
                    $('#inpclean_object').val(response.object.id);
                    $('#inpclean_object').trigger('change');
                }, 500);
            } else {
                alert('Ошибка: ' + response.error);
            }
        }).fail(function(xhr, status, error) {
            console.error('Error creating object:', error);
            alert('Ошибка создания объекта');
        }).always(function() {
            $('#submit_create_object').prop('disabled', false).text('Создать');
        });
    });

    // Добавление услуги
    $('#addServiceBtn').off('click').on('click', function() {
        var container = $('#services-container');
        var count = container.children('.service-item').length;
        
        var newService = `
            <div class="service-item">
                <div class="service-header">
                    <label>Услуга ${count + 1} *</label>
                    <button type="button" class="type-button remove-service">✕</button>
                </div>
                <div class="service-row">
                    <div class="form-group">
                        <select class="service-select" name="service[]" required>
                            <option value="">Выберите услугу</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <div class="price-display">
                            <div class="price-label">Цена (за м²):</div>
                            <span class="price-value">0 ₽</span>
                        </div>
                    </div>
                    <input type="hidden" class="service-id" name="service_id[]">
                    <input type="hidden" class="service-price" name="service_price[]">
                </div>
            </div>
        `;
        
        container.append(newService);
        
        var newSelect = container.find('.service-select').last();
        newSelect.empty().append('<option value="">Выберите услугу</option>');
        
        $.each(servicesList, function(index, service) {
            newSelect.append('<option value="' + service.id + '">' + service.label + '</option>');
        });
        
        newSelect.off('change').on('change', function() {
            loadServicePrice($(this));
        });
    });

    // Загрузка цены услуги
    function loadServicePrice(selectElement) {
        var serviceId = selectElement.val();
        var serviceItem = selectElement.closest('.service-item');
        
        if (serviceId) {
            $.ajax({
                type: 'GET',
                url: '/orders/services/' + serviceId + '/price',
                dataType: 'JSON'
            }).done(function(response) {
                if (response.price) {
                    var price = response.price;
                    serviceItem.find('.price-value').text(price.toLocaleString('ru-RU') + ' ₽/м²');
                    serviceItem.find('.service-id').val(serviceId);
                    serviceItem.find('.service-price').val(price);
                } else {
                    serviceItem.find('.price-value').text('0 ₽/м² (цена не указана)');
                    serviceItem.find('.service-id').val(serviceId);
                    serviceItem.find('.service-price').val(0);
                }
                updateTotalCost();
            }).fail(function(xhr, status, error) {
                console.error('Error loading price:', error);
                serviceItem.find('.price-value').text('Ошибка загрузки');
                serviceItem.find('.service-id').val(serviceId);
                serviceItem.find('.service-price').val(0);
                updateTotalCost();
            });
        } else {
            serviceItem.find('.price-value').text('0 ₽/м²');
            serviceItem.find('.service-id').val('');
            serviceItem.find('.service-price').val('');
            updateTotalCost();
        }
    }

    // Удаление услуги
    $(document).off('click', '.remove-service').on('click', '.remove-service', function() {
        var serviceItem = $(this).closest('.service-item');
        var container = $('#services-container');
        
        if (container.children('.service-item').length > 1) {
            serviceItem.remove();
            updateServiceNumbers();
            updateTotalCost();
        } else {
            alert('Заказ должен содержать хотя бы одну услугу');
        }
    });

    // Обновление нумерации услуг
    function updateServiceNumbers() {
        $('#services-container .service-item').each(function(index) {
            $(this).find('label').text('Услуга ' + (index + 1) + ' *');
        });
    }

    // Обновление общей стоимости (с учетом площади)
    function updateTotalCost() {
        var servicesTotal = 0;
        
        $('.service-price').each(function() {
            var price = parseInt($(this).val()) || 0;
            servicesTotal += price;
        });
        
        var totalCost = 0;
        if (currentObjectSquare > 0) {
            totalCost = servicesTotal * currentObjectSquare;
            $('#total-cost').html(totalCost.toLocaleString('ru-RU') + ' ₽<br><small>(' + servicesTotal.toLocaleString('ru-RU') + ' ₽/м² × ' + currentObjectSquare + ' м²)</small>');
        } else {
            totalCost = servicesTotal;
            $('#total-cost').html(totalCost.toLocaleString('ru-RU') + ' ₽<br><small>(площадь не указана)</small>');
        }
        
        console.log('Total cost calculated:', totalCost, 'Services total:', servicesTotal, 'Square:', currentObjectSquare);
    }

    // Обработчик изменения услуги
    $(document).off('change', '.service-select').on('change', '.service-select', function() {
        loadServicePrice($(this));
    });

    // Создание заказа
    $('#submit_create_order').off('click').on('click', function(e){
        e.preventDefault();
        
        if (isSubmitting) {
            return;
        }
        
        isSubmitting = true;
        
        var orderData = {
            id_status: $('#inpstatus').val(),
            creationDate: $('#inpcreationDate').val(),
            id_client: $('#inpclient').val(),
            id_clean_object: $('#inpclean_object').val(),
            plannedDate: $('#inpplannedDate').val(),
            description: $('#inpdescription').val()
        };

        var services = [];
        var hasErrors = false;
        
        $('.service-item').each(function() {
            var serviceId = $(this).find('.service-id').val();
            var price = $(this).find('.service-price').val();
            
            if (serviceId && price && price > 0) {
                services.push({
                    id: serviceId,
                    price: price
                });
            } else {
                hasErrors = true;
                $(this).addClass('error');
            }
        });

        if (!orderData.id_client) {
            alert('Выберите клиента');
            isSubmitting = false;
            return;
        }
        
        if (hasErrors || services.length === 0) {
            alert('Проверьте все услуги. Каждая услуга должна быть выбрана и иметь цену больше 0.');
            isSubmitting = false;
            return;
        }
        
        if (currentObjectSquare <= 0) {
            if (!confirm('Площадь объекта не указана. Общая стоимость будет рассчитана как сумма стоимостей услуг без учета площади. Продолжить?')) {
                isSubmitting = false;
                return;
            }
        }

        var submitBtn = $(this);
        submitBtn.prop('disabled', true).text('Создание...');

        $.ajax({
            type: 'POST',
            url: '/orders/create',
            data: JSON.stringify({ 
                order: orderData, 
                services: services,
                objectSquare: currentObjectSquare
            }),
            contentType: 'application/json',
            dataType: 'JSON'
        }).done(function(response) {
            if (response.success) {
                alert('Заказ успешно создан. ID заказа: ' + response.orderId);
                window.location.reload();
            } else {
                alert('Ошибка: ' + response.error);
                submitBtn.prop('disabled', false).text('Создать заказ');
                isSubmitting = false;
            }
        }).fail(function(xhr, status, error) {
            console.error('Error creating order:', error);
            alert('Ошибка при создании заказа');
            submitBtn.prop('disabled', false).text('Создать заказ');
            isSubmitting = false;
        });
    });

    // Функции очистки форм
    function clearOrderForm() {
        $('#orderForm')[0].reset();
        $('#services-container').html(`
            <div class="service-item">
                <div class="service-header">
                    <label>Услуга 1 *</label>
                    <button type="button" class="type-button remove-service">✕</button>
                </div>
                <div class="service-row">
                    <div class="form-group">
                        <select class="service-select" name="service[]" required>
                            <option value="">Выберите услугу</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <div class="price-display">
                            <div class="price-label">Цена (за м²):</div>
                            <span class="price-value">0 ₽</span>
                        </div>
                    </div>
                    <input type="hidden" class="service-id" name="service_id[]">
                    <input type="hidden" class="service-price" name="service_price[]">
                </div>
            </div>
        `);
        
        var firstSelect = $('#services-container .service-select').first();
        firstSelect.empty().append('<option value="">Выберите услугу</option>');
        
        $.each(servicesList, function(index, service) {
            firstSelect.append('<option value="' + service.id + '">' + service.label + '</option>');
        });
        
        currentObjectSquare = 0;
        $('#square-info').remove();
        updateTotalCost();
    }

    function clearClientForm() {
        $('#clientForm')[0].reset();
    }

    function clearObjectForm() {
        $('#objectForm')[0].reset();
    }

    // Закрытие модальных окон
    $(window).off('click').on('click', function(e) {
        if ($(e.target).is('.modal-window')) {
            $('.modal-window').hide();
            clearClientForm();
            clearObjectForm();
        }
    });

    // Закрытие по ESC
    $(document).off('keydown').on('keydown', function(e) {
        if (e.key === "Escape") {
            $('.modal-window').hide();
            clearClientForm();
            clearObjectForm();
        }
    });

    // Инициализация первой услуги
    setTimeout(function() {
        $('#services-container .service-select').first().off('change').on('change', function() {
            loadServicePrice($(this));
        });
    }, 100);

});