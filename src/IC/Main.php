<?php

if ( class_exists( 'IC_Main' ) ) {
	return;
}


class IC_Main {

	/**
	 * @var self
	 */
	protected static $instance;
	protected        $version = '0.40.10';

	public static function instance() {
		if ( empty( self::$instance ) ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	public function vendor( $file ) {
		if ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) {
			$_file = str_replace( '.min.js', '.js', $file );
			$file  = file_exists( IC_PATH . 'assets/vendor/' . $_file ) ? $_file : $file;
		}

		return IC_URL . 'assets/vendor/' . $file;
	}

	public function enqueue() {
		$this->ic_enqueue( 'ic/admin/enqueue_scripts', true );
	}

	public function enqueue_admin() {
		$this->ic_enqueue( 'ic/admin/enqueue_scripts', false );
	}

	public function init() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin' ) );
	}

	/**
	 * @return array
	 */
	protected function dependencies() {
		$dependencies = array( 'jquery' );

		return $dependencies;
	}

	private function ic_version() {
		return $this->version;
	}

	protected function ic_enqueue( $filter, $default ) {
		$should_enqueue = apply_filters( $filter, $default );
		if ( ! $should_enqueue ) {
			return;
		}
		$src = $this->vendor( 'intercooler-js/strict/intercooler.min.js' );
		wp_enqueue_script( 'intercooler', $src, $this->dependencies(), $this->ic_version(), true );
	}
}