var defaultPort = process.env.HTTP_PORT || 9000;  // this should match the jetty.httpPort defined in the pom.xml

// Include Gulp
var gulp = require('gulp');
var filter = require('gulp-filter');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var mainBowerFiles = require('main-bower-files');
var angularProtractor = require('gulp-angular-protractor');

// Define default destination folder
var dest = 'src/main/webapp/';

gulp.task('default', []);

gulp.task('protractor', function(httpHost,httpPort) {
    if (!httpHost) {
        httpHost = 'localhost';
    }
    var baseUrl = 'http://' + httpHost + ':' + (httpPort || defaultPort);
    console.log('Protractor configured with baseUrl=' + baseUrl);
    gulp.src(['test/js/*-spec.js'])
        .pipe(angularProtractor({
            'configFile': 'protractor.conf.js',
            'args': ['--baseUrl', baseUrl],
            'autoStartStopServer': false,
            'debug': true
        }));
});

gulp.task('js', function() {
    var jsFiles = ['src/main/js/*'];

    gulp.src(mainBowerFiles().concat(jsFiles))
        .pipe(filter('*.js'))
        .pipe(concat('main.js'))
        .pipe(uglify())
        .pipe(gulp.dest(dest + 'js'));
});

gulp.task('css', function() {
    var cssFiles = ['src/main/css/*'];

    gulp.src(mainBowerFiles().concat(cssFiles))
        .pipe(filter('*.css'))
        .pipe(concat('main.css'))
        .pipe(uglify())
        .pipe(gulp.dest(dest + 'css'));
});