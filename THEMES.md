#Themes
A quick rundown of how to create themes for LoungeDestroyer - local or otherwise.
This'll mostly detail how the JSON used by the theme parser is to be structured.

## Local (bundled) themes
These are themes that are included with LoungeDestroyer by default - they're placed in the `/themes/` folder, and the directory structure is as follows:

<table>
  <tbody>
    <tr>
      <td><code>/themes/[name]/</code></td>
      <td>
        <p>Base theme folder. All theme-related files are placed here. Note that <code>[name]</code> must be a valid Javascript variable.</p>
        <table>
          <tbody>
            <tr>
              <td><code>data.json</code></td>
              <td>Main JSON file - all data is loaded from here. Structure detailed below.</td>
            </tr>
            <tr>
              <td><code>bg.[ext]</code></td>
              <td>Default background image used in carousel on settings page. Can be overwritten in <code>data.json</code>. Suggested size is 960x540.</td>
            </tr>
            <tr>
              <td><code>icon.[ext]</code></td>
              <td>Optional. Default icon used in carousel on settings page. Can be overwritten in <code>data.json</code>. Suggested size is 50x50.</td>
            </tr>
            <tr>
              <td><code>inject.css</code></td>
              <td>Default CSS file injected into page when theme is enabled. Can be overwritten in <code>data.json</code>.</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>

## Remote themes
These are themes loaded from a URL. Remote themes do not make use of the directory structure in the same way local themes do, instead they are required to specify the absolute URL of all needed files in `data.json`. More information can be found below.

In addition to this, the server on which the JSON is hosted must allow cross-origin `GET` requests - this means returning the `Access-Control-Allow-Origin: *` and, optionally, `Access-Control-Allow-Methods: GET` headers.

And finally, all resources (background, icon, CSS) are hotlinked - as such, they must be embedable through the default HTML tags (`img` and `link`).

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
      <td>Overwrites the default background image used in carousel. Must be absolute URL to new image, or link relative to <code>options.html</code>. <code>$dir</code> will be replaced by the folder path in local themes. Suggested size is 960x540. <em>Required</em> for remote themes</td>
    </tr>
    <tr>
      <td>icon</td>
      <td>Overwrites the default icon image used in carousel. Must be absolute URL to new image, or link relative to <code>options.html</code>. <code>$dir</code> will be replaced by the folder path in local themes. Suggested size is 50x50. Icon images are optional.</td>
    </tr>
    <tr>
      <td>css</td>
      <td>Overwrites the default CSS injected into page. Must be absolute URL to new CSS. <em>Required</em> for remote themes.</td>
    </tr>
    <tr>
      <td>name</td>
      <td><em>Required</em> for remote themes. Not used for local themes. Shorthand name of theme, used internally. Must be valid Javascript variable name.</td>
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
  "name": "xmpl_theme",
  "css": "http://example.com/remote_theme.css",
  "author": "birjolaxew",
  "version": "1.0",
  "title": "Example theme",
  "description": "To showcase an example JSON structure - this should be a maximum of 140 characters long",
  "bg": "http://example.com/carousel_img.png",
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