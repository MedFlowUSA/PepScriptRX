<?php
/**
 * Executable configuration-state tests for the private WordPress bridge.
 */

define( 'ABSPATH', __DIR__ );

$GLOBALS['psrx_test_options'] = array();

class WP_REST_Response {
	private $data;
	private $status;
	public function __construct( $data, $status ) {
		$this->data   = $data;
		$this->status = $status;
	}
	public function get_data() {
		return $this->data;
	}
	public function get_status() {
		return $this->status;
	}
}

class WP_Error {
	private $code;
	private $data;
	public function __construct( $code, $message, $data ) {
		unset( $message );
		$this->code = $code;
		$this->data = $data;
	}
	public function get_error_code() {
		return $this->code;
	}
	public function get_error_data() {
		return $this->data;
	}
}

class WP_REST_Request {
	public function get_body() {
		return '{}';
	}
	public function get_header( $name ) {
		unset( $name );
		return '';
	}
}

class PSRX_Test_Payment_Gateways {
	public function payment_gateways() {
		return array( 'mps_v_2d_130' => new stdClass() );
	}
}

class PSRX_Test_WooCommerce {
	public function payment_gateways() {
		return new PSRX_Test_Payment_Gateways();
	}
}

function WC() {
	return new PSRX_Test_WooCommerce();
}
function add_action() {}
function add_filter() {}
function register_activation_hook() {}
function get_option() {
	return $GLOBALS['psrx_test_options'];
}
function wp_parse_args( $args, $defaults ) {
	return array_merge( $defaults, $args );
}

require dirname( __DIR__, 2 ) . '/wordpress/pepscriptrx-payment-bridge/pepscriptrx-payment-bridge.php';

function psrx_assert( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function psrx_complete_settings( $enabled ) {
	return array(
		'enabled'               => $enabled ? '1' : '0',
		'key_id'                => 'psrx_stg_test_key',
		'request_secret'        => str_repeat( 'a', 64 ),
		'callback_secret'       => str_repeat( 'b', 64 ),
		'mps_gateway_id'        => 'mps_v_2d_130',
		'allowed_callback_host' => 'yjexrleubnjuitiyjvoy.supabase.co',
	);
}

$GLOBALS['psrx_test_options'] = psrx_complete_settings( false );
$health                       = PepScriptRX_Payment_Bridge::health()->get_data();
psrx_assert( '0.3.1' === $health['version'], 'Health must report the three-percent plugin version.' );
psrx_assert( 'woocommerce_3_percent_v1' === $health['processing_fee_rule'], 'Health must report the three-percent fee rule.' );
psrx_assert( 300 === $health['processing_fee_basis_points'], 'Health must report a 300-basis-point fee.' );
psrx_assert( true === $health['configured'], 'Complete disabled settings must be configured.' );
psrx_assert( false === $health['enabled'], 'Disabled settings must report enabled=false.' );

$GLOBALS['psrx_test_options'] = psrx_complete_settings( true );
$health                       = PepScriptRX_Payment_Bridge::health()->get_data();
psrx_assert( true === $health['configured'], 'Complete enabled settings must be configured.' );
psrx_assert( true === $health['enabled'], 'Enabled settings must report enabled=true.' );

foreach ( array( 'key_id', 'request_secret', 'callback_secret', 'mps_gateway_id', 'allowed_callback_host' ) as $missing ) {
	$GLOBALS['psrx_test_options']             = psrx_complete_settings( false );
	$GLOBALS['psrx_test_options'][ $missing ] = '';
	$health                                   = PepScriptRX_Payment_Bridge::health()->get_data();
	psrx_assert( false === $health['configured'], "Missing {$missing} must report configured=false." );
}

$GLOBALS['psrx_test_options'] = psrx_complete_settings( false );
$result                       = PepScriptRX_Payment_Bridge::create_session( new WP_REST_Request() );
psrx_assert( 'bridge_disabled' === $result->get_error_code(), 'Disabled bridge must reject initiation.' );
psrx_assert( 503 === $result->get_error_data()['status'], 'Disabled bridge must return HTTP 503.' );

$GLOBALS['psrx_test_options']                 = psrx_complete_settings( true );
$GLOBALS['psrx_test_options']['request_secret'] = '';
$result                                       = PepScriptRX_Payment_Bridge::create_session( new WP_REST_Request() );
psrx_assert( 'unauthorized' === $result->get_error_code(), 'Incomplete enabled bridge must reject initiation.' );

echo "PASS: WordPress bridge configuration and operational gates\n";
