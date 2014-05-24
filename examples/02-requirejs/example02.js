/**
 * jquery-ovh: jQuery module to request OVH API - Example 02
 *
 * @author Jean-Philippe Blary (@blary_jp)
 * @url https://github.com/blaryjp/jquery-ovh
 * @license MIT
 */

/**
 * Configure RequireJS
 */
requirejs.config({
    paths : {
        'jquery' : '//ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min',
        'ovh'    : '../../jquery-ovh'
    }
});

/**
 * You can configure the plugin once, this way
 */
require([
    'ovh'
], function (Ovh) {

    // Set the Application Key (AK):
    Ovh.setAppKey('YOUR_APPLICATION_KEY');

    // Set the Application Secret (AS):
    Ovh.setAppSecret('YOUR_APPLICATION_SECRET');

});

/**
 * Main application
 */
require([
    'jquery',
    'ovh'
], function ($, Ovh) {

    function initLogin () {

        $('#infos').hide();

        // User click on the "Log in" button
        $('#login').bind('click', function () {
            Ovh.login();
        });
    }

    function initApp () {

        $('#login').hide();

        // Note: If you're using jQuery < 1.8,
        // you need to use .pipe() in place of .then(), for chaining promises.

        // If user is logged, get informations from OVH API
        Ovh.get('/me').then(function (infosFromApi) {

            $('#name').text(infosFromApi.name);
            $('#firstname').text(infosFromApi.firstname);
            $('#email').text(infosFromApi.email);
            $('#phone').text(infosFromApi.phone);

        });

        // Trick: Get countries enum
        Ovh.getModels('/me', 'nichandle.CountryEnum').then(function (model) {
            console.log(model.enum);
        });
    }

    // Init
    $(document).ready(function () {

        // If not logged: show the login button
        // If logged: start the app
        if (!Ovh.isLogged()) {
            initLogin();
        } else {
            initApp();
        }

    });

});
