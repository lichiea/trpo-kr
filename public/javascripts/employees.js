// $(document).ready(function(){

//     $('#create_employee').click(function(e){

//         $('#create_employee_popup').show()

//     })

//     $('#create_employee_popup_close').click(function(e){

//         $('#create_employee_popup').hide()

//     })

//     $('#cancel_create_employee').click(function(e){

//         $('#create_employee_popup').hide()

//     })

//     $('#submit_create_employee').click(function(e){
//         e.preventDefault()

//         // Правильные ID полей из list.pug
//         let data = {
//             fio: $('#inpfio').val(),  // Было $('#inpName').val()
//             phone: $('#inpphone').val(),
//             email: $('#inpemail').val(),
//             position_d: $('#inpposition_d').val(),
//             specialization: $('#inpspecialization').val()
//         };

//         // Валидация
//         if (!data.fio || !data.phone || !data.position_d) {
//             alert('Пожалуйста, заполните обязательные поля (ФИО, телефон и должность)');
//             return;
//         }

//         $.ajax({
//             type: 'POST',
//             data: JSON.stringify(data),  // Добавляем JSON.stringify
//             contentType: 'application/json',  // Указываем тип контент
//             url: '/employees/create',
//             dataType: 'JSON'
//         }).done(function( response ) {
//             if (response.msg === '') {
//                 alert('Запись о работнике создана')
//                 window.location.reload()
//             }
//             else {
//                 alert(response.msg)
//             }
//         }).fail(function(xhr, status, error) {
//             console.error('Error:', error);
//             alert('Ошибка при создании сотрудника: ' + error);
//         });
//     });


// });
