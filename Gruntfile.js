module.exports = function( grunt ) {


	// Read dependencies from composer
	var composer = grunt.file.readJSON( 'composer.json' ),
		dependencies = [];

	for ( var dep in composer.require ) {
		dependencies.push( 'vendor/' + dep );
	}

	var delete_patterns = [".git/**", "tests/**", ".gitignore", "**.md", "Gruntfile.js", "example-functions.php", "composer.{json,lock}", "{.travis,.scrutinizer,codeception*,}.yml", "coverage.clover", "phpunit.xml.dist"],
		clean_dist_patterns = ['vendor/composer/installed.json'],
		git_add_patterns = ['vendor/autoload*.php', 'vendor/composer/{autoload_*,ClassLoader*}.php'];

		for ( i = 0; i < dependencies.length; i++ ) {
			git_add_patterns.push( dependencies[i] + '**' );
			for ( k = 0; k < delete_patterns.length; k++ ) {
				clean_dist_patterns.push( dependencies[i] + '/' + delete_patterns[k] );
			}
	}
		
	// Project configuration
	grunt.initConfig( {
		pkg:    grunt.file.readJSON( 'package.json' ),
		concat: {
			options: {
				stripBanners: true,
				banner: '/*! <%= pkg.title %> - v<%= pkg.version %>\n' +
					' * <%= pkg.homepage %>\n' +
					' * Copyright (c) <%= grunt.template.today("yyyy") %>;' +
					' * Licensed GPLv2+' +
					' */\n'
			},
			intercooler: {
				src: [
					'assets/js/src/intercooler.js'
				],
				dest: 'assets/js/intercooler.js'
			}
		},
		jshint: {
			all: [
				'Gruntfile.js',
				'assets/js/src/**/*.js',
				'assets/js/test/**/*.js'
			],
			options: {
				curly:   true,
				eqeqeq:  true,
				immed:   true,
				latedef: true,
				newcap:  true,
				noarg:   true,
				sub:     true,
				undef:   true,
				boss:    true,
				eqnull:  true,
				globals: {
					exports: true,
					module:  false
				}
			}		
		},
		uglify: {
			all: {
				files: {
					'assets/js/intercooler.min.js': ['assets/js/intercooler.js']
				},
				options: {
					banner: '/*! <%= pkg.title %> - v<%= pkg.version %>\n' +
						' * <%= pkg.homepage %>\n' +
						' * Copyright (c) <%= grunt.template.today("yyyy") %>;' +
						' * Licensed GPLv2+' +
						' */\n',
					mangle: {
						except: ['jQuery']
					}
				}
			}
		},
		test:   {
			files: ['assets/js/test/**/*.js']
		},
		
		sass:   {
			all: {
				files: {
					'assets/css/intercooler.css': 'assets/css/sass/intercooler.scss'
				}
			}
		},
		
		cssmin: {
			options: {
				banner: '/*! <%= pkg.title %> - v<%= pkg.version %>\n' +
					' * <%= pkg.homepage %>\n' +
					' * Copyright (c) <%= grunt.template.today("yyyy") %>;' +
					' * Licensed GPLv2+' +
					' */\n'
			},
			minify: {
				expand: true,
				
				cwd: 'assets/css/',				
				src: ['intercooler.css'],
				
				dest: 'assets/css/',
				ext: '.min.css'
			}
		},
		watch:  {
			
			sass: {
				files: ['assets/css/sass/*.scss'],
				tasks: ['sass', 'cssmin'],
				options: {
					debounceDelay: 500
				}
			},
			
			scripts: {
				files: ['assets/js/src/**/*.js', 'assets/js/vendor/**/*.js'],
				tasks: ['jshint', 'concat', 'uglify'],
				options: {
					debounceDelay: 500
				}
			}
		},
		clean: {
			dist: clean_dist_patterns,
			'pre-update': dependencies
		},
		gitadd: {
			dist: {
				options: {
					verbose: true,
					force: true
				},
				files: {
					src: git_add_patterns
				}
			}
		}	
	} );
	
	// Load other tasks
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	
	grunt.loadNpmTasks('grunt-contrib-sass');
	
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks( 'grunt-contrib-clean' );
	grunt.loadNpmTasks( 'grunt-git' );
	
	// Default task.
	
	grunt.registerTask( 'default', ['jshint', 'concat', 'uglify', 'sass', 'cssmin'] );
	
	grunt.registerTask( 'pre-composer-update', ['clean:pre-update'] );
	grunt.registerTask( 'after-composer-update', ['clean:dist'] );

	grunt.util.linefeed = '\n';
};