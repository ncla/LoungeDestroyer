var gulp = require('gulp');
var jscs = require('gulp-jscs');
var zip = require('gulp-zip');

gulp.task('default', function () {
    return gulp.src('app/*.js')
        .pipe(jscs());
});

var requiredStuff = [
    'app/**/*.{js,css}',
    'icons/*',
    'lib/fonts/*',
    'lib/js/*',
    'popup/*',
    'settings/**/*',
    'manifest.json',
    'node_modules/tablesorter/dist/js/jquery.tablesorter.min.js',
    'node_modules/jquery/dist/jquery.min.js',
    'node_modules/moment/min/moment.min.js',
    'node_modules/moment-timezone/builds/moment-timezone-with-data.min.js',
    'node_modules/jstz/dist/jstz.min.js',
    'node_modules/marked/marked.min.js'
];

gulp.task('build', function () {
    return gulp.src(requiredStuff, {base: '.'})
        .pipe(zip('ld_build.zip'))
        .pipe(gulp.dest('build/'));
});