/**
 * jquery-ovh: jQuery module to request OVH API
 *
 * @author Jean-Philippe Blary (@blary_jp)
 * @url https://github.com/blaryjp/jquery-ovh
 * @license MIT
 */

module.exports = function (grunt) {

    var type = grunt.option('type');

    require('load-grunt-tasks')(grunt);

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        banner: '/*! jquery-ovh v<%= pkg.version %> by Jean-Philippe Blary (@blary_jp) - ' +
                'https://github.com/blaryjp/jquery-ovh - License MIT */\n',

        clean: {
            files: ['jquery-ovh.min.js']
        },

        jshint: {
            files: ['jquery-ovh.js'],
            options: {
                jshintrc: true,
            },
        },

        uglify: {
            js: {
                src: ['jquery-ovh.js'],
                dest: 'jquery-ovh.min.js',
                options: {
                    banner: '<%= banner %>'
                }
            }
        },

        bump: {
            options: {
                files: ['package.json', 'bower.json'],
                commit: true,
                push: false,
                createTag: true,
                pushTo: 'upstream',
                commitMessage: 'Release v%VERSION%',
                commitFiles: ['-a'],
                tagName: 'v%VERSION%'
            }
        }

    });

    // dev
    grunt.registerTask('default', [
        'jshint',
        'clean',
        'uglify'
    ]);

    // prod
    grunt.registerTask('release', [
        'jshint',
        'bump-only:' + type,
        'updatePkgConfig',
        'clean',
        'uglify',
        'bump-commit'
    ]);

    grunt.registerTask('updatePkgConfig', function () {
        grunt.config.set('pkg', grunt.file.readJSON('package.json'));
    });

};
