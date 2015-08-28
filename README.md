# Intercooler
*[intercooler.js](http://intercoolerjs.org/) for WordPress.*

## Installation
Download the zip file and copy it in the WordPress plugin folder, activate it.  
This plugin does nothing but enqueue [intercooler.js](http://intercoolerjs.org/) script on the page, no menus or settings are available.

## Filters
By default the plugin will enqueue the library on the front-end only and not on the back-end (the admin area).  
To override such behaviours two filters are available:

* `ic/enqueue_scripts` - `true` by default, returning `false` or a falsy value will prevent the script loading on the front-end.
* `ic/admin/enqueue_scripts` - `false` by default, returning `true` or truthy values will enqueue the script in the back-end.
