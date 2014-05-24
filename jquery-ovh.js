/**
 * jquery-ovh: jQuery module to request OVH API.
 *
 * @author Jean-Philippe Blary (@blary_jp)
 * @url https://github.com/blaryjp/jquery-ovh
 * @license MIT
 */

;(function (factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {  // AMD
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {          // Node/CommonJS
        factory(require('jquery'));
    } else {                                           // Global
        var $ = window.jQuery || window.Zepto || window.ender || window.$;
        $.ovh = factory($);
    }

})(function ($) {
    'use strict';

    var baseUrl = 'https://api.ovh.com/1.0';

    var accessRules = [
        {
            method : 'GET',
            path   : '/*'
        }, {
            method : 'POST',
            path   : '/*'
        }, {
            method : 'PUT',
            path   : '/*'
        }, {
            method : 'DELETE',
            path   : '/*'
        }
    ];

    var keys = {
        ak: '',    // Application Key
        as: '',    // Application Secret key
        ck: ''     // Consumer Key
    };


    /*==========  CONF  ==========*/

    /**
     * (Optional) Set the API base URL.
     */
    function setBaseUrl (url) {
        baseUrl = url;
    }

    /**
     * (Mandatory) Set the Application Key (AK).
     */
    function setAppKey (ak) {
        keys.ak = ak;
    }

    /**
     * (Mandatory) Set the Application Secret key (AS).
     */
    function setAppSecret (as) {
        keys.as = as;
    }

    /**
     * (Optional) Set the Consumer Key (CK).
     * Useful when you've a token and then don't want to log the user.
     */
    function setConsumerKey (ck) {
        keys.ck = ck;
        localStorage.setItem('ovh-ck', ck);
    }

    /**
     * (Optional) Set the access rules.
     * Restrict the requests access (default to "all access").
     */
    function setAccessRules (rules) {
        accessRules = rules;
    }


    /*==========  MODULE  ==========*/

    // At init, get CK if present
    keys.ck = localStorage.getItem('ovh-ck');

    /**
     * Log the user (request a new credential).
     * It will redirect the user to the OVH API login page.
     *
     * @param  {string} urlToRedirect (Optional) When logged, redirect user to this URL.
     * @return {jqXHR}                Done/Fail.
     */
    function login (urlToRedirect) {

        // Delete old CK, if logged
        if (isLogged()) {
            localStorage.removeItem('ovh-ck');
            keys.ck = null;
        }

        return $.ajax({
            type        : 'POST',
            url         : baseUrl + '/auth/credential',
            headers     : $.extend({
                'X-Ovh-Application' : keys.ak
            }, getHeaders()),
            processData : false,
            data        : JSON.stringify({
                accessRules : accessRules,
                redirection : urlToRedirect || window.location.href
            })
        }).then(function (data) {

            // Consumer Key!
            keys.ck = data.consumerKey;

            // Save it to localStorage
            localStorage.setItem('ovh-ck', keys.ck);

            // Redirect to Auth page
            window.location = data.validationUrl;

            return data;

        });
    }

    /**
     * Log out the user (expire current credential).
     *
     * @return {jqXHR} Done/Fail.
     */
    function logout () {

        // If we're not logged: reject
        if (!isLogged()) {
            return rejectNotCredential();
        }

        return getApiTimeDiff().then(function (diff) {
            return $.ajax({
                type    : 'POST',
                url     : baseUrl + '/auth/logout',
                headers : getHeaders({
                    method : 'POST',
                    url    : baseUrl + '/auth/logout',
                    body   : '',
                    diff   : diff
                })
            }).then(function () {
                // Delete old CK
                localStorage.removeItem('ovh-ck');
                keys.ck = null;
            }, function (error) {
                // Delete old CK
                localStorage.removeItem('ovh-ck');
                keys.ck = null;
                return error;
            });
        }, function (error) {
            return error;
        });
    }

    /**
     * Perform a request to the OVH API.
     *
     * @param  {object} config  $.ajax configuration object (see jQuery docs).
     * @return {jqXHR}          Done/Fail.
     */
    function request (config) {

        // Only requests with the "noAuthentication" flag can call the API without being logged
        if (!isLogged() && !config.noAuthentication) {
            return rejectNotCredential();
        }

        return getApiTimeDiff().then(function (diff) {

            // Because we delete params from original object, save a local copy.
            var params = config.params;

            // User can use an url like "/dedicated/server/{serviceName}" with the corresponding parameters (here, "serviceName"),
            // and it will be automatically replaced.
            // Based on a great idea of @gierschv
            if (config.params && ~config.url.indexOf('{')) {
                // Because we delete params from original object, save a local copy.
                params = $.extend({}, config.params);

                $.each(params, function (paramKey, paramVal) {
                    if ((new RegExp('{' + paramKey + '}')).test(config.url)) {
                        config.url = config.url.replace('{' + paramKey + '}', encodeURIComponent(paramVal));
                        delete params[paramKey];
                    }
                });
            }

            // Get cached params
            config.params = params;

            // Get headers
            config.headers = config.noAuthentication ? getHeaders() : getHeaders({
                method : config.type,
                url    : config.url,
                body   : config.data ? JSON.stringify(config.data) : '',
                diff   : diff
            });

            // If datas : stringify them!
            if (config.data) {
                config.processData = false;
                config.data = JSON.stringify(config.data);
            }

            // Let's go!
            return $.ajax(config);

        });
    }

    /**
     * Get specific schema from API.
     *
     * @param  {string} schemaPath Path of the schema (like "/me").
     * @return {jqXHR}             Done/Fail.
     */
    function getSchema (schemaPath) {
        return $.ajax({
            type    : 'GET',
            url     : baseUrl + schemaPath + '.json',
            cache   : true,
            headers : getHeaders()
        });
    }

    /**
     * Get all or a specific Models from API.
     *
     * @param  {string} schemaPath Path of the schema (like "/me.json").
     * @param  {string} name       (Optional) Models name.
     * @return {jqXHR}             Done/Fail.
     */
    function getModels (schemaPath, name) {
        return getSchema(schemaPath).then(function (schema) {
            // If no "name" param, return all models
            if (!name) {
                return schema.models;
            }
            // Return only the requested models
            return schema.models[name];
        });
    }


    /*==========  COMMON  ==========*/

    /**
     * User is logged ?
     *
     * @return {boolean} True/False.
     */
    function isLogged () {
        return !!keys.ck;
    }

    /**
     * Get API time and calculate the difference with system clock.
     *
     * @return {jqXHR} Done/Fail.
     */
    function getApiTimeDiff () {
        return $.ajax({
            type    : 'GET',
            url     : baseUrl + '/auth/time',
            cache   : true,
            headers : getHeaders()
        }).then(function (data) {

            // Calculate the time lag between system clock and API time
            return Math.floor(Date.now() / 1000) - data;

        });
    }

    /**
     * Sign the request with SHA-1 encryption.
     *
     * @param  {object} opts Informations required for signature.
     * @return {string}      Signed request.
     */
    function signRequest (opts) {
        return '$1$' + SHA1([keys.as, keys.ck, opts.method, opts.url, opts.body, opts.diff].join('+'));
    }

    /**
     * Get request headers.
     *
     * @param  {object} opts (Optional) Informations about authentified request.
     * @return {object}      The headers.
     */
    function getHeaders (opts) {
        if (!opts) {
            // No authentication
            return {
                'Content-Type' : 'application/json;charset=UTF-8'
            };
        } else {
            var diff = (Math.floor(Date.now() / 1000) - opts.diff).toString();
            return {
                'Content-Type'      : 'application/json;charset=UTF-8',
                'X-Ovh-Application' : keys.ak,
                'X-Ovh-Consumer'    : keys.ck,
                'X-Ovh-Timestamp'   : diff,
                'X-Ovh-Signature'   : signRequest({
                    method : opts.method,
                    url    : opts.url,
                    body   : opts.body,
                    diff   : diff
                })
            };
        }
    }

    /**
     * Reject promise with "NOT_CREDENTIAL".
     *
     * @return {jqXHR} Rejected promise.
     */
    function rejectNotCredential () {
        var msg = { errorCode: 'NOT_CREDENTIAL', message: 'This credential does not exist' };
        return $.Deferred().reject({
            responseJSON : msg,
            responseText : JSON.stringify(msg),
            status       : 403,
            statusText   : 'Forbidden'
        }, 'error', 'Bad Request').promise();
    }

    /**
     *  Secure Hash Algorithm (SHA1)
     *  http://www.webtoolkit.info/
     */
    /* jshint ignore:start */
    function SHA1 (msg) {

        function rotate_left(n,s) {
            var t4 = ( n<<s ) | (n>>>(32-s));
            return t4;
        }

        function lsb_hex(val) {
            var str='';
            var i;
            var vh;
            var vl;

            for( i=0; i<=6; i+=2 ) {
                vh = (val>>>(i*4+4))&0x0f;
                vl = (val>>>(i*4))&0x0f;
                str += vh.toString(16) + vl.toString(16);
            }
            return str;
        }

        function cvt_hex(val) {
            var str='';
            var i;
            var v;

            for( i=7; i>=0; i-- ) {
                v = (val>>>(i*4))&0x0f;
                str += v.toString(16);
            }
            return str;
        }

        function Utf8Encode(string) {
            string = string.replace(/\r\n/g,'\n');
            var utftext = '';

            for (var n = 0; n < string.length; n++) {

                var c = string.charCodeAt(n);

                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }

            }

            return utftext;
        }

        var blockstart;
        var i, j;
        var W = new Array(80);
        var H0 = 0x67452301;
        var H1 = 0xEFCDAB89;
        var H2 = 0x98BADCFE;
        var H3 = 0x10325476;
        var H4 = 0xC3D2E1F0;
        var A, B, C, D, E;
        var temp;

        msg = Utf8Encode(msg);

        var msg_len = msg.length;

        var word_array = new Array();
        for( i=0; i<msg_len-3; i+=4 ) {
            j = msg.charCodeAt(i)<<24 | msg.charCodeAt(i+1)<<16 |
            msg.charCodeAt(i+2)<<8 | msg.charCodeAt(i+3);
            word_array.push( j );
        }

        switch( msg_len % 4 ) {
            case 0:
                i = 0x080000000;
            break;
            case 1:
                i = msg.charCodeAt(msg_len-1)<<24 | 0x0800000;
            break;

            case 2:
                i = msg.charCodeAt(msg_len-2)<<24 | msg.charCodeAt(msg_len-1)<<16 | 0x08000;
            break;

            case 3:
                i = msg.charCodeAt(msg_len-3)<<24 | msg.charCodeAt(msg_len-2)<<16 | msg.charCodeAt(msg_len-1)<<8    | 0x80;
            break;
        }

        word_array.push( i );

        while( (word_array.length % 16) != 14 ) word_array.push( 0 );

        word_array.push( msg_len>>>29 );
        word_array.push( (msg_len<<3)&0x0ffffffff );


        for ( blockstart=0; blockstart<word_array.length; blockstart+=16 ) {

            for( i=0; i<16; i++ ) W[i] = word_array[blockstart+i];
            for( i=16; i<=79; i++ ) W[i] = rotate_left(W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16], 1);

            A = H0;
            B = H1;
            C = H2;
            D = H3;
            E = H4;

            for( i= 0; i<=19; i++ ) {
                temp = (rotate_left(A,5) + ((B&C) | (~B&D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
                E = D;
                D = C;
                C = rotate_left(B,30);
                B = A;
                A = temp;
            }

            for( i=20; i<=39; i++ ) {
                temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
                E = D;
                D = C;
                C = rotate_left(B,30);
                B = A;
                A = temp;
            }

            for( i=40; i<=59; i++ ) {
                temp = (rotate_left(A,5) + ((B&C) | (B&D) | (C&D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
                E = D;
                D = C;
                C = rotate_left(B,30);
                B = A;
                A = temp;
            }

            for( i=60; i<=79; i++ ) {
                temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
                E = D;
                D = C;
                C = rotate_left(B,30);
                B = A;
                A = temp;
            }

            H0 = (H0 + A) & 0x0ffffffff;
            H1 = (H1 + B) & 0x0ffffffff;
            H2 = (H2 + C) & 0x0ffffffff;
            H3 = (H3 + D) & 0x0ffffffff;
            H4 = (H4 + E) & 0x0ffffffff;

        }

        var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);

        return temp.toLowerCase();

    }
    /* jshint ignore:end */


    // External functions
    var fcts = {
        setBaseUrl     : setBaseUrl,
        setAppKey      : setAppKey,
        setAppSecret   : setAppSecret,
        setConsumerKey : setConsumerKey,
        setAccessRules : setAccessRules,

        login          : login,
        logout         : logout,
        isLogged       : isLogged,
        getSchema      : getSchema,
        getModels      : getModels
    };

    // Generate all REST requests
    $.each(['get', 'put', 'post', 'delete', 'remove', 'del'], function (key, name) {
        fcts[name] = function (url, config) {
            return request($.extend(config || {}, {
                type : ((name === 'remove' || name === 'del') ? 'delete' : name).toUpperCase(),
                url  : baseUrl + url
            }));
        };
    });

    return fcts;

});
