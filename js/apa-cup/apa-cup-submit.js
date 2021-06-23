$(document).ready(function(){
    var num_vertices = 0;
    var coordinates = null;
    var distances = null;
    var current_instance = null;

    
    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    var forms = document.getElementsByClassName('needs-validation');
    // Loop over them and prevent submission
    var validation = Array.prototype.filter.call(forms, function(form) {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopPropagation();

            form.classList.add('was-validated');

            if(form.checkValidity() === true)
                callValidation();
            
        }, false);
    });

    readsBestSolutions();


    /****************************************************************************************
     * 
     * FUNCTION callValidation
     * 
     ****************************************************************************************/
    function callValidation(){
        $('#btn-submit').toggleClass('d-none');
        $('#btn-sending').toggleClass('d-none');

        $('#container-alerts').empty();

        var instance_name = null;
        var group_id = $('#select-group option:selected').val();
        var group_name = $('#select-group option:selected').data("name");
        var group_members = $('#select-group option:selected').data("members");
        var group_members_short = $('#select-group option:selected').data("members-short");
        var solution_str = $('#textarea-solution').val();
        var solution_cost_user = $('#input-cost').val();

        switch(parseInt($('#select-instance option:selected').val())){
            case 1:
                instance_name = 'cup1';
                break;
            case 2:
                instance_name = 'cup2';
                break;
            case 3:
                instance_name = 'cup3';
                break;
            // --- DEBUG ONLY ---
            case 4:
                instance_name = 'cup4';
                break;
            // --- DEBUG ONLY ---
        }

        if(instance_name == null){
            alertUser('Alguma coisa saiu errado! Por favor, comunique o erro ao professor informando o código de erro.', 1, 60, 10);
        }
        else{
            var result = validateSolution(instance_name, solution_str, solution_cost_user);
            $('#btn-sending').toggleClass('d-none');
            if(result.success){
                // -------------------------------------------
                // Only allow the user to send solutions that are better than the current one
                var best_sol = $('#select-group option[value=' + group_id + ']').data('best-sol-' + instance_name);
                console.log("best_sol = " + best_sol);
                console.log("current_sol = " + result.cost_evaluated);
                if(best_sol != -1 && best_sol <= result.cost_evaluated){
                    alertUser('Você já enviou uma solução de valor melhor!! A solução atual tem valor <strong>' + result.cost_evaluated + '</strong> enquanto que a melhor tem valor <strong>' + best_sol + '</strong>. Sendo assim essa solução não será enviada...', 1, 30, 11);
                }
                else{
                    if($('#alert-successfully-sent').hasClass('d-none')){
                        
                        solution_str = solution_str.replace(/\n/g, '').replace(/\s/g,'');
                        
                        // Prepare the email
                        var message_str = "Solution:\n" +
                            "{\n" + 
                            "\t\"solution\": {\n" + 
                            "\t\t\"instance_name\": \"" + instance_name + "\",\n" +  
                            "\t\t\"group_id\": " + group_id + ",\n" +  
                            "\t\t\"group_name\": \"" + group_name + "\",\n" +  
                            "\t\t\"group_members\": \"" + group_members + "\",\n" +  
                            "\t\t\"group_members_short\": \"" + group_members_short + "\",\n" +  
                            "\t\t\"time_stamp\": \"" + moment().format() + "\",\n" +  
                            "\t\t\"solution_cost_user\": " + solution_cost_user + ",\n" + 
                            "\t\t\"solution_cost_evaluated\": " + result.cost_evaluated + ",\n" + 
                            "\t\t\"solution_user\": \"" + solution_str + "\",\n" + 
                            "\t\t\"solution\": \"" + result.solution + "\"\n" + 
                            "\t}\n" + 
                            "}";

                            $.ajax({
                                type: "POST",
                                url: "https://hooks.zapier.com/hooks/catch/5750378/o2ukzbb/",
                                data:{ 
                                    'message': message_str, 
                                    'group': group_id, 
                                    'value': result.cost_evaluated, 
                                    'instance': instance_name
                                },
                                success: function(){
                                    // Show the success message
                                    $('#alert-successfully-sent').removeClass('d-none');

                                    // Hide the message after 30 seconds
                                    setTimeout(function(){
                                        $('#alert-successfully-sent').addClass('d-none');
                                    }, 30000);

                                    $('#btn-submit').toggleClass('d-none');

                                },
                                error: function(){
                                    alertUser("Não foi possível enviar sua solução. Por favor entre em contato com o professor para reportar o erro!",  1, 60, null);

                                    $('#btn-submit').toggleClass('d-none');
                                },
                                dataType: "json"
                            });

                        
                    }
                }
            }
        }

        
    };

    // -------------------------------------------
    // EVENT when the success message is closed
    $('#alert-successfully-sent .close').on('click', function(e){
        e.preventDefault();
        
        if(!$('#alert-successfully-sent').hasClass('d-none'))
            $('#alert-successfully-sent').addClass('d-none');

        return false;
    });

    // -------------------------------------------
    // EVENT click in the modal send button
    $('#btn-submit-confirm').on('click', function(e){
        $("#btn-submit").click();
    });
    

    /****************************************************************************************
     * 
     * FUNCTION validateSolution
     * 
     ****************************************************************************************/
    function validateSolution(instance_name, solution_str, solution_cost){
        var result = {
            'success': false,
            'cost_evaluated' : null,
            'solution': null
        }

        // -------------------------------------------
        // First parse the solution and check if its format is valid
        var solution = solution_str.replace(/\s+/g,'').trim().split(';');
        for(var i = 0 ; i < solution.length ; i++){
            // Parse each route
            solution[i] = solution[i].split(',');

            for(var j = 0 ; j < solution[i].length ; j++){
                solution[i][j] = parseInt(solution[i][j]);
                
                if(isNaN(solution[i][j])){
                    alertUser("A solução informada não está no formato correto! Leia as instruções acima para descobrir como formatar sua solução.", 1, 30, null);
                    setSolutionFieldInvalid();
                    return result;
                }
            }
        }

        result.solution = "";
        solution.join(';');
        for(var i = 0 ; i < solution.length ; i++){
            result.solution += solution[i].join(',');
            if(i+1 != solution.length)
                result.solution += ";";
        }
        
        // -------------------------------------------
        // If the format is ok, read the instance
        var instance = readInstance(instance_name);

        
        // -------------------------------------------
        // Initial and final vertices in each route
        for(var i = 0 ; i < solution.length ; i++)
            if(solution[i][0] != solution[i][solution[i].length-1]){
                alertUser("Rota número " + (i+1) + " inviável, o primeiro vértice deve ser igual ao último!", 1, 30, null);
                setSolutionFieldInvalid();
                return result;
            }
            else if(solution[i][0] != 0){
                alertUser("Rota número " + (i+1) + " inviável, a rota deve iniciar na sede (vértice 0)!", 1, 30, null);
                setSolutionFieldInvalid();
                return result;
            }

        // -------------------------------------------
        // Check routes' length
        for(var i = 0 ; i < solution.length ; i++)
            if(solution[i].length - 2 > instance.p){
                alertUser("Rota número " + (i+1) + " inviável, pois visita mais endereços do que o permitido! São visitados " + solution[i].length - 2 + " enquanto que o limite é " + instance.p, 1, 30, null);
                setSolutionFieldInvalid();
                return result;
            }

        // -------------------------------------------
        // Check if a vertex is visited more than once
        var is_visited = new Array(instance.num_vertices).fill(false);
        for(var k = 0 ; k < solution.length ; k++){
            for(var i = 1 ; i < solution[k].length - 1; i++){
                // Make sure the current vertex is valid
                if(solution[k][i] >= instance.num_vertices || solution[k][i] < 0){
                    alertUser("Solução inviável! Na rota " + (k+1) + ", o cliente " + solution[k][i] + " não existe!", 1, 30, null);
                    setSolutionFieldInvalid();
                    return result;
                }

                // Check if the current vertex has already been visited
                if(is_visited[solution[k][i]]){
                    alertUser("Solução inviável! Na rota " + (k+1) + " o cliente " + solution[k][i] + " é visitado mais de uma vez!", 1, 30, null);
                    setSolutionFieldInvalid();
                    return result;
                }

                is_visited[solution[k][i]] = true;
            }
        }

        // -------------------------------------------
        // Check if all clientes have been visited
        for(var k = 1 ; k < instance.num_vertices ; k++){
            if(!is_visited[k]){
                alertUser("Solução inviável! O cliente " + k + " nunca é visitado!", 1, 30, null);
                setSolutionFieldInvalid();
                return result;
            }
        }

        // -------------------------------------------
        // Evaluate the cost of the solution
        var solution_cost_double_check = 0;
        for(var k = 0 ; k < solution.length ; k++){
            for(var i = 0 ; i < solution[k].length - 1; i++){
                solution_cost_double_check += instance.distances[solution[k][i]][solution[k][i+1]];
            }
        }

        // -------------------------------------------
        // Make sure the cost informed by the user is the same as the one that was evaluated
        if(solution_cost_double_check != solution_cost){
            alertUser("A solução informada possui valor <strong>" + solution_cost_double_check + "</strong>, mas foi informado " + solution_cost + ". Note que iremos considerar o valor correto, mas isso pode indicar um bug em seu código.", 2, 30, null);
        }

        result.success = true;
        result.cost_evaluated = solution_cost_double_check;
        $('#textarea-solution').removeClass('is-invalid')

        return result;
    }
    
    
    /****************************************************************************************
     * 
     * FUNCTION readInstance
     * 
     ****************************************************************************************/
    function readInstance(instance_name){
        var instance = {
            'num_vertices': 0,
            'p': 0,
            'distances': []
        }

        $.ajax({
            url: '/assets/apa-cup/instances/' + instance_name + '.txt',
            async: false,
            success: function(result){
                var rows = result.split('\n');
                var index_row = 0;

                // -------------------------------------------
                // Find the number of vertices
                while(index_row != rows.length){
                    if(rows[index_row] == "#num_vertices"){
                        index_row++;
                        instance.num_vertices = parseInt(rows[index_row]);
                        break;
                    }
                    index_row++;
                }

                // -------------------------------------------
                // Find the value of p
                while(index_row != rows.length){
                    if(rows[index_row] == "#P"){
                        index_row++;
                        instance.p = parseInt(rows[index_row]);
                        break;
                    }
                    index_row++;
                }

                // -------------------------------------------
                // Read the distance matrix
                while(index_row != rows.length){
                    if(rows[index_row] == "#distances"){
                        index_row++;
                        break;
                    }
                    index_row++;
                }

                instance.distances = new Array(instance.num_vertices);
                for(var i = 0 ; i < instance.num_vertices ; i++){
                    var values = rows[index_row].replace(/\s+/g,' ').trim().split(' ');
                    for(var j = 0 ; j < values.length ; j++)
                        values[j] =  parseInt(values[j]);
                    instance.distances[i] = values;
                    index_row++;
                }

                console.log(instance);
            }
        });

        return instance;
    }


    /****************************************************************************************
     * 
     * FUNCTION alertUser
     * 
     ****************************************************************************************/
    function alertUser(message, type, dismiss_time, codigo){
        var $alert = $('<div class="alert alert-' + (type == 1 ? 'danger' : 'warning') + ' alert-dismissible fade show" role="alert"></div>')
                        .append('<strong>' + (type == 1 ? 'Erro' : 'Aviso') + (codigo != null ? (' ' + codigo) : '') + ':</strong> ' + message)
                        .append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');

        $('#container-alerts').append($alert);

        // Remove the message after 10 seconds
        setTimeout(function(){
            $alert.remove();
        }, dismiss_time * 1000);
    }

    /****************************************************************************************
     * 
     * FUNCTION setSolutionFieldInvalid
     * 
     ****************************************************************************************/
    function setSolutionFieldInvalid(){
        $('#form-tsp-cup-submit').removeClass('was-validated');
        if(!$('#textarea-solution').hasClass('is-invalid')){
            $('#textarea-solution').addClass('is-invalid').removeClass('is-valid');
        }
    }

    /****************************************************************************************
     * 
     * FUNCTION readsBestSolutions
     * 
     ****************************************************************************************/
    function readsBestSolutions(){
        $.ajax({
            dataType: "json",
            url: "/assets/apa-cup/solutions.json",
            success: function(data){
                var solutions = data.solutions;
                var select = $('#select-group');
                for(var i = 0 ; i < solutions.length ; i++)
                    select.children('option[value=' + solutions[i].group_id + ']').data('best-sol-' + solutions[i].instance_name, solutions[i].solution_cost_evaluated);
            }
        });
    }
});