$(document).ready(function(){

    $('#create_team').click(function(e){
        $('#create_team_popup').show()
    })

    $('#create_team_popup_close').click(function(e){
        $('#create_employee_popup').hide()  // Исправлено на правильный ID
    })

    $('#cancel_create_team').click(function(e){
        $('#create_employee_popup').hide()  // Исправлено на правильный ID
    })
    
});