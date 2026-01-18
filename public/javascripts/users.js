$(document).ready(function(){

    $.ajax({
        type: 'GET',
        url: '/api/users',
        dataType: 'JSON'
    }).done(function( response ) {

        response.users.forEach(user => {
            $('#tbl_users').append(
                `<tr>
                    <td>${user.id}
                    <td>${user.login}
                    <td>${user.pass}
                    <td>${user.role_label}
                </tr>`
            )
        })

    });
})