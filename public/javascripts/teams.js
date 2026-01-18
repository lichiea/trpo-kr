$(document).ready(function(){

    $.ajax({
        type: 'GET',
        url: '/api/teams',
        dataType: 'JSON'
    }).done(function( response ) {

        response.teams.forEach(team => {
            $('#tbl_teams').append(
                `<tr>
                    <td>${team.id}
                    <td>${team.id_taskmaster}
                </tr>`
            )
        })

    });
})