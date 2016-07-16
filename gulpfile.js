var gulp = require('gulp');
var jscs = require('gulp-jscs');
var zip = require('gulp-zip');
var merge = require('merge-stream');
var jeditor = require('gulp-json-editor');
var gulpif = require('gulp-if');
var argv = require('yargs').argv;
var filter = require('gulp-filter');
var change = require('gulp-change');

var requiredStuff = [
    'app/**/*.{js,css}',
    'icons/*',
    'lib/fonts/*',
    'lib/js/*',
    'settings/**/*',
    'node_modules/tablesorter/dist/js/jquery.tablesorter.min.js',
    'node_modules/jquery/dist/jquery.min.js',
    'node_modules/moment/min/moment.min.js',
    'node_modules/moment-timezone/builds/moment-timezone-with-data.min.js',
    'node_modules/jstz/dist/jstz.min.js',
    'node_modules/marked/marked.min.js',
    'node_modules/dompurify/src/purify.js',
    'node_modules/selectize/dist/js/standalone/selectize.min.js'
];

var watchList = [
    'app/**/*.{js,css}',
    'icons/*',
    'lib/fonts/*',
    'lib/js/*',
    'settings/**/*',
    'manifest.json'
];

gulp.task('default', function () {
    return gulp.src('app/*.js')
        .pipe(jscs());
});

gulp.task('build', function () {
    var appJsFilter = filter(['**/*.js', '!**/*.min.js'], {restore: true});

    function performChange(content, done) {
        content = content.replace(/^(?:(?![\n\r])\s*)?[^\/]{0,2}((\$log|console)\.(warn|log|info))(.*)$/gm, '');
        done(null, content);
    }

    var chromeBase = gulp.src(requiredStuff, {base: '.'})
        .pipe(appJsFilter)
        .pipe(gulpif((argv.production == true), change(performChange)))
        .pipe(appJsFilter.restore)
        .pipe(gulp.dest('build/chrome'));

    var firefoxBase = gulp.src(requiredStuff, {base: '.'})
        .pipe(appJsFilter)
        .pipe(gulpif((argv.production == true), change(performChange)))
        .pipe(appJsFilter.restore)
        .pipe(gulp.dest('build/firefox'));

    var firefoxManifest = gulp.src('manifest.json')
        .pipe(jeditor(function(json) {
            json.applications = {
                'gecko': {
                    'id': 'loungedestroyer@ncla.me',
                    'strict_min_version': '50.0a1',
                    'strict_max_version': '*'
                }
            };

            var removePermissions = [
                '*://csgolounge.com/*',
                '*://steamcommunity.com/*',
                '*://dota2lounge.com/*',
                'unlimitedStorage'
            ];

            for (var i = 0; i < removePermissions.length; i++) {
                var index = json.permissions.indexOf(removePermissions[i]);

                if (index > -1) {
                    json.permissions.splice(index, 1);
                }
            }

            json.permissions.push('*://*.csgolounge.com/*', '*://*.steamcommunity.com/*', '*://*.dota2lounge.com/*');
            json.permissions.push('tabs');

            delete json.background.persistent;
            delete json.options_page;

            json.browser_action['browser_style'] = false;

            return json;
        }))
        .pipe(gulp.dest('build/firefox'));

    var chromeManifest = gulp.src('manifest.json')
        .pipe(gulp.dest('build/chrome'));

    return merge(chromeBase, chromeManifest, firefoxBase, firefoxManifest);
});

gulp.task('package', ['build'], function() {
    var epoch = +new Date();

    var chrome = gulp.src('build/chrome/**/*.*')
        .pipe(zip('loungedestroyer-chrome-' + epoch + '.zip'))
        .pipe(gulp.dest('dist/'));

    var firefox = gulp.src('build/firefox/**/*.*')
        .pipe(zip('loungedestroyer-firefox-' + epoch + '.zip'))
        .pipe(gulp.dest('dist/'));

    return merge(chrome, firefox);
});

gulp.task('watch', function() {
    gulp.watch(watchList, ['build']);
});