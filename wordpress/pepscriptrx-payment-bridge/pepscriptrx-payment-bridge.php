<?php
/**
 * Plugin Name: PepScriptRX Payment Bridge
 * Description: Private, signed WooCommerce checkout bridge for PepScriptRX.
 * Version: 0.2.1
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce
 *
 * @package PepScriptRX_Payment_Bridge
 */

defined( 'ABSPATH' ) || exit;

/**
 * Private checkout bridge between PepScriptRX and WooCommerce.
 */
final class PepScriptRX_Payment_Bridge {
	const OPT = 'pepscriptrx_bridge_settings';
	const NS  = 'pepscriptrx-bridge/v1';

	/**
	 * Register WordPress and WooCommerce hooks.
	 */
	public static function boot() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'status_changed' ), 10, 4 );
		add_action( 'woocommerce_order_refunded', array( __CLASS__, 'order_refunded' ), 10, 2 );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'settings' ) );
		add_action( 'template_redirect', array( __CLASS__, 'checkout_guard' ) );
		add_action( 'wp_head', array( __CLASS__, 'noindex' ) );
		add_action( 'pepscriptrx_bridge_delete_nonce', array( __CLASS__, 'delete_nonce_lock' ) );
		add_filter( 'woocommerce_available_payment_gateways', array( __CLASS__, 'only_mps' ) );
		add_filter( 'woocommerce_get_return_url', array( __CLASS__, 'return_url' ), 10, 2 );
	}

	/**
	 * Register bridge REST routes.
	 */
	public static function routes() {
		register_rest_route(
			self::NS,
			'/sessions',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'create_session' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			self::NS,
			'/health',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'health' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Report non-sensitive bridge configuration and immutable launch policies.
	 *
	 * @return WP_REST_Response
	 */
	public static function health() {
		return new WP_REST_Response(
			array(
				'ok'                          => true,
				'version'                     => '0.2.1',
				'configured'                  => self::configured(),
				'enabled'                     => self::enabled(),
				'processing_fee_rule'         => 'woocommerce_6_percent_v1',
				'processing_fee_basis_points' => 600,
				'inventory_automation'        => false,
				'promo_mutation'              => false,
			),
			200
		);
	}

	/**
	 * Load settings with disabled-safe defaults.
	 *
	 * @return array<string,string>
	 */
	private static function options() {
		return wp_parse_args(
			get_option( self::OPT, array() ),
			array(
				'enabled'               => '0',
				'key_id'                => '',
				'request_secret'        => '',
				'callback_secret'       => '',
				'mps_gateway_id'        => '',
				'allowed_callback_host' => '',
				'debug'                 => '0',
			)
		);
	}

	/**
	 * Determine whether the operational bridge switch is enabled.
	 *
	 * @return bool
	 */
	private static function enabled() {
		$options = self::options();
		return '1' === $options['enabled'];
	}

	/**
	 * Determine whether every required setting is valid and present.
	 *
	 * @return bool
	 */
	private static function configured() {
		$options       = self::options();
		$key_id        = (string) $options['key_id'];
		$gateway_id    = (string) $options['mps_gateway_id'];
		$callback_host = strtolower( trim( (string) $options['allowed_callback_host'] ) );
		if ( ! preg_match( '/^[a-z0-9_-]{8,100}$/', $key_id ) ||
			strlen( (string) $options['request_secret'] ) < 32 ||
			strlen( (string) $options['callback_secret'] ) < 32 ||
			! filter_var( $callback_host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME ) ||
			! preg_match( '/^[a-z0-9_]{3,100}$/', $gateway_id ) ) {
			return false;
		}
		if ( ! function_exists( 'WC' ) || ! WC() || ! WC()->payment_gateways() ) {
			return false;
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		return isset( $gateways[ $gateway_id ] );
	}

	/**
	 * Validate a signed return destination against the fixed PepScriptRX hosts.
	 *
	 * @param string $url Candidate URL.
	 * @return bool
	 */
	private static function allowed_return_url( $url ) {
		$host    = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		$scheme  = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		$path    = (string) wp_parse_url( $url, PHP_URL_PATH );
		$allowed = array( 'pepscriptrx.com', 'www.pepscriptrx.com', 'pepscriptrx.vercel.app', 'pepscriptrx-git-agen-c9d866-manuel-rodriguezs-projects-f5946c44.vercel.app' );
		return 'https' === $scheme && in_array( $host, $allowed, true ) && 0 === strpos( $path, '/pay/' );
	}

	/**
	 * Remove an expired atomic nonce lock.
	 *
	 * @param string $option_name Private option name.
	 */
	public static function delete_nonce_lock( $option_name ) {
		if ( 0 === strpos( (string) $option_name, 'psrx_nonce_' ) ) {
			delete_option( $option_name );
		}
	}

	/**
	 * Create or recover an idempotent WooCommerce payment session.
	 *
	 * @param WP_REST_Request $request Signed REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_session( WP_REST_Request $request ) {
		$o         = self::options();
		$raw       = $request->get_body();
		$key       = (string) $request->get_header( 'x-psrx-key-id' );
		$signature = strtolower( (string) $request->get_header( 'x-psrx-signature' ) );
		if ( ! self::enabled() ) {
			return new WP_Error( 'bridge_disabled', 'Bridge disabled', array( 'status' => 503 ) );
		}
		if ( ! self::configured() || ! hash_equals( $o['key_id'], $key ) ||
			! hash_equals( hash_hmac( 'sha256', $raw, $o['request_secret'] ), $signature ) ) {
			return new WP_Error( 'unauthorized', 'Unauthorized', array( 'status' => 401 ) );
		}
		$p = json_decode( $raw, true );
		if ( ! is_array( $p ) || abs( time() - intval( $p['timestamp'] ?? 0 ) ) > 300 ||
			empty( $p['nonce'] ) || empty( $p['session_token'] ) || empty( $p['expires_at'] ) ||
			strtoupper( (string) ( $p['currency'] ?? '' ) ) !== 'USD' ) {
			return new WP_Error( 'invalid_request', 'Invalid request', array( 'status' => 400 ) );
		}
		if ( strtotime( $p['expires_at'] ) <= time() || strtotime( $p['expires_at'] ) > time() + 1200 ) {
			return new WP_Error( 'expired', 'Session expired', array( 'status' => 410 ) );
		}
		if ( ! self::allowed_return_url( $p['return_url'] ?? '' ) || ! self::allowed_return_url( $p['cancel_url'] ?? '' ) ) {
			return new WP_Error( 'invalid_destination', 'Invalid return destination', array( 'status' => 400 ) );
		}
		$amount         = intval( $p['amount_cents'] ?? 0 );
		$pre_fee_amount = intval( $p['pre_fee_amount_cents'] ?? 0 );
		$fee_amount     = intval( $p['expected_processing_fee_cents'] ?? -1 );
		$captured_total = intval( $p['expected_captured_total_cents'] ?? 0 );
		$fee_rule       = sanitize_key( $p['processing_fee_rule'] ?? '' );
		$fee_basis      = intval( $p['processing_fee_basis_points'] ?? 0 );
		$expected_fee   = intdiv( ( $pre_fee_amount * 600 ) + 5000, 10000 );
		if ( 'woocommerce_6_percent_v1' !== $fee_rule || 600 !== $fee_basis ||
			$expected_fee !== $fee_amount || $captured_total !== $pre_fee_amount + $fee_amount ||
			$amount !== $captured_total ) {
			return new WP_Error( 'fee_contract', 'Checkout total requires review', array( 'status' => 409 ) );
		}
		if ( $amount < 1500 || $amount > 140000 ) {
			return new WP_Error( 'amount_range', 'Amount outside approved range', array( 'status' => 422 ) );
		}
		$token_hash = hash( 'sha256', $p['session_token'] );
		$existing   = wc_get_orders(
			array(
				'limit'      => 1,
				'return'     => 'ids',
				'meta_key'   => '_psrx_session_hash',
				'meta_value' => $token_hash,
			)
		);
		if ( $existing ) {
			$order = wc_get_order( $existing[0] );
			return new WP_REST_Response(
				array(
					'woo_order_id' => $order->get_id(),
					'checkout_url' => $order->get_checkout_payment_url(),
				),
				200
			);
		}
		$nonce_option = 'psrx_nonce_' . hash( 'sha256', $p['nonce'] );
		if ( ! add_option( $nonce_option, time(), '', false ) ) {
			return new WP_Error( 'replay', 'Request already used', array( 'status' => 409 ) );
		}
		wp_schedule_single_event( time() + ( 20 * MINUTE_IN_SECONDS ), 'pepscriptrx_bridge_delete_nonce', array( $nonce_option ) );

		if ( empty( $p['items'] ) || ! is_array( $p['items'] ) ) {
			return new WP_Error( 'invalid_items', 'Checkout items require review', array( 'status' => 409 ) );
		}
		$order               = wc_create_order();
		$line_subtotal_cents = 0;
		$line_total_cents    = 0;
		foreach ( (array) ( $p['items'] ?? array() ) as $item ) {
			$product_id     = sanitize_text_field( $item['product_id'] ?? '' );
			$name           = sanitize_text_field( $item['name'] ?? '' );
			$variation      = sanitize_text_field( $item['variation'] ?? '' );
			$qty            = max( 1, min( 20, intval( $item['quantity'] ?? 0 ) ) );
			$unit_cents     = intval( $item['unit_amount_cents'] ?? 0 );
			$subtotal_cents = intval( $item['line_subtotal_cents'] ?? 0 );
			$discount_cents = intval( $item['discount_cents'] ?? 0 );
			$total_cents    = intval( $item['line_total_cents'] ?? 0 );
			if ( ! $product_id || ! $name || $unit_cents <= 0 ||
				$subtotal_cents !== $unit_cents * $qty || $discount_cents < 0 ||
				$total_cents !== $subtotal_cents - $discount_cents ) {
				$order->delete( true );
				return new WP_Error( 'invalid_items', 'Checkout items require review', array( 'status' => 409 ) );
			}
			$line = new WC_Order_Item_Product();
			$line->set_name( $variation ? $name . ' — ' . $variation : $name );
			$line->set_quantity( $qty );
			$line->set_subtotal( $subtotal_cents / 100 );
			$line->set_total( $total_cents / 100 );
			$line->add_meta_data( '_psrx_product_reference', $product_id, true );
			if ( ! empty( $item['sku'] ) ) {
				$line->add_meta_data( '_psrx_sku', sanitize_text_field( $item['sku'] ), true );
			}
			$order->add_item( $line );
			$line_subtotal_cents += $subtotal_cents;
			$line_total_cents    += $total_cents;
		}
		$merchandise_cents = intval( $p['merchandise_subtotal_cents'] ?? -1 );
		$discount_cents    = intval( $p['discount_total_cents'] ?? -1 );
		$shipping_cents    = intval( $p['shipping_total_cents'] ?? -1 );
		$tax_cents         = intval( $p['tax_total_cents'] ?? -1 );
		if ( $line_subtotal_cents !== $merchandise_cents || $line_total_cents !== $merchandise_cents - $discount_cents ||
			0 !== $tax_cents || $pre_fee_amount !== $line_total_cents + $shipping_cents + $tax_cents ) {
			$order->delete( true );
			return new WP_Error( 'structured_total', 'Checkout total requires review', array( 'status' => 409 ) );
		}
		$shipping = new WC_Order_Item_Shipping();
		$shipping->set_method_title( sanitize_text_field( $p['shipping']['method'] ?? 'Standard shipping' ) );
		$shipping->set_method_id( 'pepscriptrx_' . sanitize_key( $p['shipping']['method'] ?? 'standard' ) );
		$shipping->set_total( $shipping_cents / 100 );
		$order->add_item( $shipping );
		$fee = new WC_Order_Item_Fee();
		$fee->set_name( 'Processing Fee' );
		$fee->set_amount( $fee_amount / 100 );
		$fee->set_total( $fee_amount / 100 );
		$fee->set_tax_status( 'none' );
		$order->add_item( $fee );
		$customer = is_array( $p['customer'] ?? null ) ? $p['customer'] : array();
		$parts    = preg_split( '/\s+/', trim( sanitize_text_field( $customer['full_name'] ?? '' ) ), 2 );
		$address  = array(
			'first_name' => $parts[0] ?? '',
			'last_name'  => $parts[1] ?? '',
			'email'      => sanitize_email( $customer['email'] ?? '' ),
			'phone'      => sanitize_text_field( $customer['phone'] ?? '' ),
			'address_1'  => sanitize_text_field( $customer['shipping_address'] ?? '' ),
			'city'       => sanitize_text_field( $customer['shipping_city'] ?? '' ),
			'state'      => sanitize_text_field( $customer['shipping_state'] ?? '' ),
			'postcode'   => sanitize_text_field( $customer['shipping_zip'] ?? '' ),
			'country'    => 'US',
		);
		$order->set_address( $address, 'billing' );
		$order->set_address( $address, 'shipping' );
		$order->set_currency( 'USD' );
		$order->set_payment_method( $o['mps_gateway_id'] );
		$order->set_payment_method_title( 'Credit or Debit Card' );
		$order->update_meta_data( '_psrx_session_hash', $token_hash );
		$order->update_meta_data( '_psrx_session_token', $p['session_token'] );
		$order->update_meta_data( '_psrx_expected_amount_cents', $amount );
		$order->update_meta_data( '_psrx_callback_url', esc_url_raw( $p['callback_url'] ?? '' ) );
		$order->update_meta_data( '_psrx_return_url', esc_url_raw( $p['return_url'] ?? '' ) );
		$order->update_meta_data( '_psrx_cancel_url', esc_url_raw( $p['cancel_url'] ?? '' ) );
		$order->update_meta_data( '_psrx_origin_store', sanitize_text_field( $p['origin_store'] ?? 'PepScriptRX' ) );
		$order->update_meta_data( '_psrx_cart_fingerprint', sanitize_text_field( $p['cart_fingerprint'] ?? '' ) );
		$order->update_meta_data( '_psrx_expected_processing_fee_cents', $fee_amount );
		$order->update_meta_data( '_psrx_attribution', wp_json_encode( is_array( $p['attribution'] ?? null ) ? $p['attribution'] : array() ) );
		$order->calculate_totals();
		if ( intval( round( $order->get_total() * 100 ) ) !== $amount ) {
			$order->delete( true );
			return new WP_Error( 'amount_mismatch', 'Order total mismatch', array( 'status' => 409 ) );
		}
		$order->save();
		return new WP_REST_Response(
			array(
				'woo_order_id' => $order->get_id(),
				'checkout_url' => $order->get_checkout_payment_url(),
			),
			201
		);
	}

	/**
	 * Restrict bridge order-payment pages to the configured MPS gateway.
	 *
	 * @param array $gateways Available gateways.
	 * @return array
	 */
	public static function only_mps( $gateways ) {
		if ( ! is_wc_endpoint_url( 'order-pay' ) ) {
			return $gateways;
		}
		$o = self::options();
		foreach ( $gateways as $id => $gateway ) {
			if ( $id !== $o['mps_gateway_id'] ) {
				unset( $gateways[ $id ] );
			}
		}
		return $gateways;
	}

	/**
	 * Return bridge orders only to an allow-listed PepScriptRX host.
	 *
	 * @param string   $url   Default URL.
	 * @param WC_Order $order WooCommerce order.
	 * @return string
	 */
	public static function return_url( $url, $order ) {
		if ( ! $order || ! $order->get_meta( '_psrx_session_hash', true ) ) {
			return $url;
		}
		$return = $order->get_meta( '_psrx_return_url', true );
		if ( in_array( $order->get_status(), array( 'failed', 'cancelled' ), true ) ) {
			$return = $order->get_meta( '_psrx_cancel_url', true );
		}
		return self::allowed_return_url( $return ) ? $return : $url;
	}

	/**
	 * Report a WooCommerce order status transition.
	 *
	 * @param int      $order_id Order ID.
	 * @param string   $from     Previous status.
	 * @param string   $to       New status.
	 * @param WC_Order $order    WooCommerce order.
	 */
	public static function status_changed( $order_id, $from, $to, $order ) {
		$token = $order->get_meta( '_psrx_session_token', true );
		if ( ! $token ) {
			return;
		}
		// Refund callbacks are emitted from woocommerce_order_refunded with the
		// stable refund ID, avoiding a second full-refund event here.
		if ( 'refunded' === $to ) {
			return;
		}
		$map    = array(
			'pending'    => 'awaiting_payment',
			'on-hold'    => 'payment_processing',
			'processing' => 'paid',
			'completed'  => 'paid',
			'failed'     => 'failed',
			'cancelled'  => 'cancelled',
		);
		$status = $map[ $to ] ?? 'reconciliation_required';
		if ( 'paid' === $status && ( ! $order->is_paid() || ! in_array( $order->get_status(), wc_get_is_paid_statuses(), true ) ) ) {
			$status = 'reconciliation_required';
		}
		if ( 'cancelled' === $to && in_array( $from, wc_get_is_paid_statuses(), true ) ) {
			$status = 'voided';
		}
		self::callback( $order, $status, null, 'wc-status-' . $order_id . '-' . $to );
	}

	/**
	 * Report a WooCommerce refund using the stable refund identifier.
	 *
	 * @param int $order_id  Order ID.
	 * @param int $refund_id Refund ID.
	 */
	public static function order_refunded( $order_id, $refund_id ) {
		$order  = wc_get_order( $order_id );
		$refund = wc_get_order( $refund_id );
		if ( ! $order || ! $refund || ! $order->get_meta( '_psrx_session_token', true ) ) {
			return;
		}
		$refunded     = abs( (float) $order->get_total_refunded() );
		$status       = $refunded >= (float) $order->get_total() ? 'refunded' : 'partially_refunded';
		$fee_refunded = 0.0;
		foreach ( $order->get_refunds() as $prior_refund ) {
			foreach ( $prior_refund->get_fees() as $refunded_fee ) {
				if ( 'processing fee' === strtolower( trim( $refunded_fee->get_name() ) ) ) {
					$fee_refunded += abs( (float) $refunded_fee->get_total() + (float) $refunded_fee->get_total_tax() );
				}
			}
		}
		$shipping_tax_refunded = abs( (float) $order->get_total_shipping_refunded() ) + abs( (float) $order->get_total_tax_refunded() );
		$breakdown             = array(
			'merchandise_refunded_cents'    => max( 0, intval( round( ( $refunded - $shipping_tax_refunded - $fee_refunded ) * 100 ) ) ),
			'shipping_tax_refunded_cents'   => intval( round( $shipping_tax_refunded * 100 ) ),
			'processing_fee_refunded_cents' => intval( round( $fee_refunded * 100 ) ),
		);
		self::callback( $order, $status, $refunded, 'wc-refund-' . $refund_id, $breakdown );
	}

	/**
	 * Send a signed callback to the configured PepScriptRX endpoint.
	 *
	 * @param WC_Order    $order           WooCommerce order.
	 * @param string      $status          Normalized payment status.
	 * @param float|null  $reversed_amount Reversed amount in major currency units.
	 * @param string|null $event_id          Stable provider event identifier.
	 * @param array       $reversal_breakdown Reversed merchandise, shipping/tax, and fee amounts.
	 */
	private static function callback( $order, $status, $reversed_amount = null, $event_id = null, $reversal_breakdown = array() ) {
		$o    = self::options();
		$url  = $order->get_meta( '_psrx_callback_url', true );
		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! $url || ! hash_equals( strtolower( $o['allowed_callback_host'] ), strtolower( (string) $host ) ) ) {
			return;
		}
		$processing_fee = 0.0;
		$fee_count      = 0;
		foreach ( $order->get_fees() as $fee ) {
			if ( 'processing fee' === strtolower( trim( $fee->get_name() ) ) ) {
				++$fee_count;
				$processing_fee += (float) $fee->get_total() + (float) $fee->get_total_tax();
			}
		}
		$captured_cents = intval( round( $order->get_total() * 100 ) );
		$fee_cents      = intval( round( $processing_fee * 100 ) );
		$payload        = wp_json_encode(
			array(
				'event_id'              => $event_id ? $event_id : wp_generate_uuid4(),
				'timestamp'             => time(),
				'session_token'         => $order->get_meta( '_psrx_session_token', true ),
				'woo_order_id'          => $order->get_id(),
				'status'                => $status,
				'amount_cents'          => intval( round( $order->get_total() * 100 ) ),
				'captured_total_cents'  => $captured_cents,
				'processing_fee_cents'  => $fee_cents,
				'processing_fee_count'  => $fee_count,
				'pre_fee_amount_cents'  => $captured_cents - $fee_cents,
				'cart_fingerprint'      => sanitize_text_field( $order->get_meta( '_psrx_cart_fingerprint', true ) ),
				'currency'              => $order->get_currency(),
				'processor_reference'   => sanitize_text_field( $order->get_transaction_id() ),
				'woo_status'            => $order->get_status(),
				'woo_is_paid'           => $order->is_paid(),
				'payment_method'        => sanitize_key( $order->get_payment_method() ),
				'paid_at'               => $order->get_date_paid() ? $order->get_date_paid()->date( DATE_ATOM ) : null,
				'reversed_amount_cents' => null === $reversed_amount ? null : intval( round( $reversed_amount * 100 ) ),
				'reversal_breakdown'    => $reversal_breakdown,
			)
		);
		wp_remote_post(
			$url,
			array(
				'timeout' => 15,
				'headers' => array(
					'Content-Type'     => 'application/json',
					'X-PSRX-Key-Id'    => $o['key_id'],
					'X-PSRX-Signature' => hash_hmac( 'sha256', $payload, $o['callback_secret'] ),
				),
				'body'    => $payload,
			)
		);
	}

	/**
	 * Register the WooCommerce settings submenu.
	 */
	public static function menu() {
		add_submenu_page( 'woocommerce', 'PepScriptRX Bridge', 'PepScriptRX Bridge', 'manage_woocommerce', 'pepscriptrx-bridge', array( __CLASS__, 'page' ) );
	}
	/**
	 * Register bridge settings.
	 */
	public static function settings() {
		register_setting( 'pepscriptrx_bridge', self::OPT, array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) ) );
	}
	/**
	 * Sanitize bridge settings while preserving write-only secrets.
	 *
	 * @param array $input Submitted settings.
	 * @return array
	 */
	public static function sanitize( $input ) {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return self::options();
		}
		$old = self::options();
		return array(
			'enabled'               => ! empty( $input['enabled'] ) ? '1' : '0',
			'debug'                 => ! empty( $input['debug'] ) ? '1' : '0',
			'key_id'                => sanitize_key( $input['key_id'] ?? '' ),
			'request_secret'        => empty( $input['request_secret'] ) ? $old['request_secret'] : sanitize_text_field( $input['request_secret'] ),
			'callback_secret'       => empty( $input['callback_secret'] ) ? $old['callback_secret'] : sanitize_text_field( $input['callback_secret'] ),
			'mps_gateway_id'        => sanitize_key( $input['mps_gateway_id'] ?? '' ),
			'allowed_callback_host' => strtolower( sanitize_text_field( $input['allowed_callback_host'] ?? '' ) ),
		);
	}
	/**
	 * Render the bridge settings page.
	 */
	public static function page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$o = self::options(); ?>
		<div class="wrap"><h1>PepScriptRX Payment Bridge</h1>
		<p>Secrets are write-only. Blank secret fields retain their current values.</p>
		<form method="post" action="options.php"><?php settings_fields( 'pepscriptrx_bridge' ); ?>
		<table class="form-table">
		<tr><th>Enabled</th><td><input type="checkbox" name="<?php echo esc_attr( self::OPT ); ?>[enabled]" value="1" <?php checked( $o['enabled'], '1' ); ?>></td></tr>
		<tr><th>Key ID</th><td><input name="<?php echo esc_attr( self::OPT ); ?>[key_id]" value="<?php echo esc_attr( $o['key_id'] ); ?>"></td></tr>
		<tr><th>Request secret</th><td><input type="password" autocomplete="new-password" name="<?php echo esc_attr( self::OPT ); ?>[request_secret]" value=""></td></tr>
		<tr><th>Callback secret</th><td><input type="password" autocomplete="new-password" name="<?php echo esc_attr( self::OPT ); ?>[callback_secret]" value=""></td></tr>
		<tr><th>MPS gateway ID</th><td><input name="<?php echo esc_attr( self::OPT ); ?>[mps_gateway_id]" value="<?php echo esc_attr( $o['mps_gateway_id'] ); ?>"></td></tr>
		<tr><th>Allowed callback host</th><td><input name="<?php echo esc_attr( self::OPT ); ?>[allowed_callback_host]" value="<?php echo esc_attr( $o['allowed_callback_host'] ); ?>"></td></tr>
		</table><?php submit_button(); ?></form></div>
		<?php
	}
	/**
	 * Prevent this private payment host from serving the general checkout.
	 */
	public static function checkout_guard() {
		if ( is_checkout() && ! is_wc_endpoint_url( 'order-pay' ) ) {
			wp_safe_redirect( home_url( '/' ) );
		}
	}
	/**
	 * Mark all checkout and payment pages as non-indexable.
	 */
	public static function noindex() {
		if ( is_checkout() || is_wc_endpoint_url( 'order-pay' ) ) {
			echo "<meta name=\"robots\" content=\"noindex,nofollow,noarchive\">\n";
		}
	}
}
PepScriptRX_Payment_Bridge::boot();
