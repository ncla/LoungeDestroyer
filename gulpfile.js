var gulp = require('gulp');
var jscs = require('gulp-jscs');
var gulpFilter = require('gulp-filter');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-minify-css');
var minifyHTML = require('gulp-minify-html');
var zip = require('gulp-zip');

gulp.task('default', function () {
    return gulp.src('app/*.js')
        .pipe(jscs());
});

var requiredStuff = [
    'app/**/*.{js,css}',
    'icons/*',
    'lib/css/bootstrap.min.css',
    'lib/css/ld.css',
    'lib/css/font-awesome.min.css',
    'lib/fonts/*',
    'lib/js/*',
    'popup/*',
    'settings/**/*',
    'manifest.json'
];

gulp.task('build', function () {
    var jsFilter = gulpFilter(['**/*.js']);
    var cssFilter = gulpFilter(['**/*.css']);
    var htmlFilter = gulpFilter(['**/*.html']);

    return gulp.src(requiredStuff, {base: '.'})
        //.pipe(jsFilter)
        //.pipe(uglify())
        //.pipe(jsFilter.restore())
        //.pipe(cssFilter)
        //.pipe(minifyCss())
        //.pipe(cssFilter.restore())
        //.pipe(htmlFilter)
        //.pipe(minifyHTML())
        //.pipe(htmlFilter.restore())
        .pipe(zip('ld_build.zip'))
        .pipe(gulp.dest('build/'));
});