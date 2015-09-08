The epic CONTRIBUTING.md file. If you are willing to contribute to LoungeDestroyer, this file is for you.

#Application structure

Everything that is LoungeDestroyer application can be found in `app/` directory.
With this project I want MVC and OOP feel in the application. Trades, bets, queues, items and so on have their own class and their own seperate file. Those should all be considered as *models* part of application, except for `inject.js` which is supposed to be controller part of application. `inject.js` should not have any *model* part of MVC, this file is for interecating with the *view* part of the application (which is the pages we develop for). There is another exception `helpers.js` which is supposed to be for 3rd party functions and not application related stuff.

`app/css/` is for application stylesheets, and not 3rd party stylesheets.
Use `lib/` for 3rd party library stuff.
`app/bg/` is for applications background tasks. `background.js` is for most of the background task stuff, `bet.js` is for auto-betting/returning stuff which is maintained by @birjolaxew.

If a method does not fit in a specific class, you can just create a static new function in the same file.

#Contributing code

First you have to discuss new implementations with @ncla and @birjolaxew first by opening new issue on issue tracker. Do not bother wasting time writing code and then creating pull request expecting that it will be accepted.

You can use both jQuery and JavaScript, but you have to keep in mind the performance issues when using jQuery (and sometimes but less often with Javascript too). Name your functions and variables properly, write logic so that other developers understand what are you doing. Code documentation is not obligatory unless it's something complex or a one liner type of thing.

Thanks to the developers at CSGOLounge/DOTA2Lounge, application should be written in such way that it does not rely heavily on hardcoded values. Stuff like depending heavily on certain elements, very specific URLs and other values. Be sure to utilize Chrome API where possible.

DOTA2Lounge and CSGOLounge, although very similar, does have some differences. This is important to keep in mind since LoungeDestroyer supports Dota2 site too. You have to test for both sites. For some reason DOTA2Lounge seems to receive more love than CSGOLounge, and receives new features first, and then CSGOLounge implements them after some period of time.

This does not only apply to writing JavaScript code, but also creating stylesheet. You should not rely heavily on styles provided by Lounge stylesheet, instead style it fully without depending on page styling.

Both sites have dark and bright theme, at first it might seem that only difference is in the background and button stuff. Different theme can cause some graphical issues with application's inserted elements. You have to test new element additions and new styles on both dark and bright themes.

#Coding standards

We use Airbnb JS ES5 coding standards for our project, with few custom rules set in `.jscsrc` file.

To check your coding style, you can set up your IDE to do so, for example, you can install JSCS for PhpStorm and it points out incorrect code styles. Alternatively you can install `gulp` through npm package manager, and then install `gulp-jscs`. Once you have installed both, you can simply run `gulp` to check code style against files in `app/` directory, or if you want to check against one single file, you can type `jscs app/items.js`.