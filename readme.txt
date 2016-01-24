=== Intercooler.js ===
Contributors: lucatume
Tags: js, ajax
Requires at least: 3.0.1
Tested up to: 4.4.1
Stable tag: /trunk/
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

This plugin will enqueue the [intercooler.js](http://intercoolerjs.org/) library on the site front-end and, optionally, on the backend.

== Description ==
The plugin comes with no menus or admininstration settings and activating it will enqueue the script on the site front-end.
To have the script enqueued on the site back-end hook into the `ic/admin/enqueue_scripts` hook and return a truthy value like this:

	add_filter('ic/admin/enqueue_scripts', '__return_true');

To avoid the script from being enqueued on the site front-end hook into the `ic/enqueue_scripts` hook and return a falsy value like this:

	add_filter('ic/enqueue_scripts', '__return_false');

See the [library homepage](http://intercoolerjs.org/) for more information about this amazing library.

== Installation ==
1. Upload the plugin files to the `/wp-content/plugins/plugin-name` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Done, the plugin has no settings.

== Frequently Asked Questions ==

= How do I have the script enqueued in the front-end too? =
To have the script enqueued on the site back-end hook into the `ic/admin/enqueue_scripts` hook and return a truthy value like this:

	add_filter('ic/admin/enqueue_scripts', '__return_true');

= How do I prevent the script from being enqueued on the front-end? =
To avoid the script from being enqueued on the site front-end hook into the `ic/enqueue_scripts` hook and return a falsy value like this:

	add_filter('ic/enqueue_scripts', '__return_false');

= How do I use the library as a requirement for my own scripts? =
The library is enqueued using the `intercooler` handle, the library will require jQuery in turn (handle `jquery`), use that to require the library as a dependency for your own:

	wp_enqueue_script( 'my_lib', $my_lib_src_file, array( 'intercooler' ) );

= How do I use the library? =
See the [library homepage](http://intercoolerjs.org/).

== Screenshots ==

== Changelog ==

= 1.0.0 =
* first release, packs intercooler-js v. 0.9.3
