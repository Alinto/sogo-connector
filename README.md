# To package the extension 

First create a directory structure in custom/ that corresponds to your site
name. Use "sogo-demo" as an example. You can do so by doing:

```
% cp -a custom/sogo-demo custom/mysite
```

Then customize the following file:

* custom/mysite/chrome/content/sogo-connector/general/custom-preferences.js

You must at least customize the sogo-connector.baseURL value. If you
want to force-push preferences prefix your option with force_.

To build the extension, do:

```
% make distclean
% make custom-build=mysite
```

# Logging

## For development enable debug messages

Taken from: http://brainflush.wordpress.com/2008/01/17/mozilla-thunderbird-extension-development-environment-setup/

javascript.options.showInConsole = true.
  Logs errors in chrome files to the Error Console.
  
browser.dom.window.dump.enabled = true.
  Enables the use of the dump() statement to print to the standard console. See window.dump for more info. You can also use nsIConsoleService from privileged script.
  
javascript.options.strict = true.
  Enables strict JavaScript warnings in the Error Console. Note that since many people have this setting turned off when developing, you will see lots of warnings for problems with their code in addition to warnings for your own extension. You can filter those with Console2.

You can do so automatically by setting these preferences in custom-preferences.js:

```javascript
pref("javascript.options.showInConsole", true);
pref("browser.dom.window.dump.enabled", true);
pref("javascript.options.strict", true);
```

## Making the standard output console visible

Taken from: https://developer.mozilla.org/en-US/docs/DOM/window.dump?redirectlocale=en-US&redirectslug=DOM%3Awindow.dump

On Windows, you will need a console to actually see anything. If you don't have one already, closing the application and re-opening it with the command line parameter -console should create the console. On other operating systems, it's enough to launch the application from a terminal.

## Debugging and changing code without restart Thunderbird

Setting breakpoints to stop inside JS code of a plugin using JavaScript Debugger Venkman does not work.
Instead, install plugin Workspace for Thunderbird -> http://antennasoft.net/robcee/

Place all your code, you want to test, there and execute it. You can even defined functions there.
If you cannot override an existing JS function, you have to rename it.

## Other notes

Command line parameter for starting Thunderbird in DEVEL mode:  -purgecaches -console -no-remote -P dev

More useful hints for developers: https://developer.mozilla.org/en/docs/Setting_up_extension_development_environment

# Migrating to Thunderbird v68 from previous versions

First of all, SOGo Integrator is no longer needed. All SOGo Integrator preferences have been renamed to
"sogo-connector". For example:

```
sogo-integrator.disable-calendaring
```

was renamed to:

```
sogo-connector.disable-calendaring
```

Here is the list of renamed preference keys:

```
sogo-integrator.autocomplete.server.urlid
sogo-integrator.disable-calendaring
sogo-integrator.disable-send-invitations-checkbox
```

All SOGo Connector preferences:

```
sogo-connector.autoComplete.commentAttribute
sogo-connector.autoComplete.delay
sogo-connector.contacts.categories
sogo-connector.identification.use_email_address
sogo-connector.sogo-prefix
```
