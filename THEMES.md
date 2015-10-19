#Themes
A quick rundown of how to create themes for LoungeDestroyer.
This'll mostly detail how the JSON used by the theme parser is to be structured.

## CSS restrictions
Due to technical restrictions imposed upon us by Chrome, the theme CSS is changed prior to injecting it into a page. Most importantly, **all** values have `!important` appended to them - as such, using `!important` in your theme may not work as intended. We are unfortunately unable to change this before the Chrome team fixes the priority level of injected CSS.

As an example, if the following CSS is linked as theme CSS:

```
body {
    background: red;
    box-shadow: inset 2px 0px 4px green;
}
```

The following will be injected into the page (here shown prettified - actual injected CSS is minified):

```
body {
    background: red !important;
    box-shadow: inset 2px 0px 4px green !important;
}
```

Alternatively you can style the site from scratch by disabling the sites stylesheet completely. To do that you have to set `disableCss` property in the data.json file.

## Adding themes in extension for testing
To load a custom theme in LoungeDestroyer, first you will need to host all necessary files somewhere. You will also need to download LoungeDestroyer source code and edit `app/bg/themes.js` file, and append your theme data.json URL in object `themeListOriginal`. After that you reload the extension for the object changes to take effect. After that, you edit your theme CSS file, and when you are ready to try it out, go in the settings and press 'Reset & Update themes' button to reload your theme.

In addition to this, the server on which the JSON and theme CSS is hosted, must allow cross-origin `GET` requests - this means returning the `Access-Control-Allow-Origin: *` and, optionally, `Access-Control-Allow-Methods: GET` headers. Alternatively you can just add your domain to manifest.json under `permissions` section. You can host the theme files on your PC as well through some web server (WAMP etc.)

Remote themes index their structure and basic information in a JSON file, which is then loaded and parsed by LoungeDestroyer. The structure of said JSON file must adhere to the one in section **JSON structure** for LoungeDestroyer to successfully load the theme.

And finally, all images (background, icon) are hotlinked - as such, they must be embedable through the `img` HTML tag.

## JSON structure
The following JSON structure is understood by the theme parser. Note that, when updating the theme, the `checked` values of all options are kept their local value, while everything else is overwritten by the remote value.

<table>
  <tbody>
    <tr>
      <td>title</td>
      <td><em>Required</em> - The title of the theme, displayed to the user</td>
    </tr>
    <tr>
      <td>description</td>
      <td>A short description of the theme. Should be a maximum of 140 characters long.</td>
    </tr>
    <tr>
      <td>author</td>
      <td>Specifies the name of the theme author. Displayed in carousel.</td>
    </tr>
    <tr>
      <td>version</td>
      <td>Specifies the version of the theme. Not parsed internally, so can be any string.</td>
    </tr>
    <tr>
      <td>bg</td>
      <td><em>Required</em> - Absolute URL to the image displayed as background in the theme carousel on the options page. Suggested size is 960x540.</td>
    </tr>
    <tr>
      <td>icon</td>
      <td>Absolute URL to the image displayed as icon in the theme carousel on the options page. Suggested size is 50x50. Icon images are optional.</td>
    </tr>
    <tr>
      <td>css</td>
      <td><em>Required</em> - Absolute URL to the CSS injected into the page. Must allow cross-origin `GET` requests.</td>
    </tr>
    <tr>
      <td>name</td>
      <td><em>Required</em> - Shorthand name of theme, used internally. Must be valid Javascript variable name.</td>
    </tr>
    <tr>
      <td>collapsibleColumns</td>
      <td>Whether to prepend a <code>div.ld-collapse-toggle</code> to all columns (and the side menu), which toggles the <code>.ld-collapsed</code> class on click.</td>
    </tr>
    <tr>
      <td>changelog</td>
      <td>An absolute URL of the changelog of the theme. Optional.</td>
    </tr>
    <tr>
      <td>disableCss</td>
      <td>true/false, will disable the site stylesheets on CSGOLounge/DOTA2Lounge</td>
    </tr>
    <tr>
      <td>options</td>
      <td>
        <p>Optional options for theme. Currently only supports checkboxes.</p>
        <table>
          <tbody>
            <tr>
              <td>[option-name]</td>
              <td>
                <p>The class name to add to <code>body</code> if option is enabled.</p>
                <table>
                  <tbody>
                    <tr>
                      <td>description</td>
                      <td>Short text to describe option to user.</td>
                    </tr>
                    <tr>
                      <td>checked</td>
                      <td>Default value - must be either <code>true</code> or <code>false</code></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td align="middle">[...]</td>
              <td align="middle">[...]</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>

An example JSON file for a remote theme is below:

```json
{
  "name": "example_theme",
  "css": "http://example.com/remote_theme.css",
  "author": "birjolaxew",
  "version": "1.0",
  "title": "Example theme",
  "description": "To showcase an example JSON structure - this should be a maximum of 140 characters long",
  "bg": "http://example.com/carousel_img.png",
  "disableCss": true
  "options": {
    "class1": {
      "description": "If selected, .body.class1 will match body",
      "checked": true
    },
    "class2": {
      "description": "If selected, .body.class2 will match body",
      "checked": false
    }
  }
}
```

## Styling the theme

Extension provides classes for `<body>` tag to help you style for each page and each Lounge site (classes `appID730`, `main`, `mybets` and so on). You can only modify CSS of the site, we do not provide scripting. It's the same reason that we have when developing extension, to hard code least amount of stuff possible. Another concern by us is security (possibilities to do some exploits with JS).

Their sites have inline styling in some places, and creating a CSS selector might be difficult task, but it is possible. Just because it doesn't have ID or class doesn't mean you can't select it. Take for example `.title` element that has background image showing a dice icon, you can select it like this `.title[style*="bets.png"]`.

You have to test your theme on all pages there are (`/missingitems`, `/donations`, `/giveaway`). Do not forget about both site support. Although they are same structure now, make sure that everything looks fine. Don't forget about elements that are appended by extension, and think about other user-scripts/extension that add their elements.

## Themes bundled with extension

We are open to bundling high-quality, polished themes into our extension as default themes - if you have created a theme that you believe should be included, please open an issue (using the menu to the right), and we'll have a look!
