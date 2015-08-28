<?php
/**
 * Plugin Name: Intercooler.js
 * Plugin URI:  http://theaveragedev.com
 * Description: Intercooler.js for WordPress
 * Version:     0.1.0
 * Author:      Luca Tumedei
 * Author URI:  http://theaveragedev.com
 * License:     GPLv2+
 * Text Domain: ic
 * Domain Path: /languages
 */

/**
 * Copyright (c) 2015 Luca Tumedei (email : luca@theaveragedev.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2 or, at
 * your discretion, any later version, as published by the Free
 * Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

// Useful global constants
define( 'IC_VERSION', '0.1.0' );
define( 'IC_URL', plugin_dir_url( __FILE__ ) );
define( 'IC_PATH', dirname( __FILE__ ) . '/' );

require_once 'vendor/autoload_52.php';

/**
 * Load the plugin
 */
if ( ! function_exists( 'ic_load' ) ) {
	function ic_load() {
		IC_Main::instance()->init();
	}

	add_action( 'plugins_loaded', 'ic_load' );
}
