$(document).ready(function(){

    $.ajax({
        type: 'GET',
        url: '/api/transports',
        dataType: 'JSON'
    }).done(function( response ) {

        response.transports.forEach(transport => {
            $('#tbl_transports').append(
                `<tr>
                    <td>${transport.id}
                    <td>${transport.model}
                    <td>${transport.registrationNumber}
                </tr>`
            )
        })

    });
})