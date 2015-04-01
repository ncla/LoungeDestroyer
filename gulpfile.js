var jshint = require('gulp-jshint');
var gulp   = require('gulp');
var watch  = require('gulp-watch');

gulp.task('default', ['watch']);

gulp.task('watch', function() {
    watch("app/*.js")
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'));
});