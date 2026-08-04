<?php
/**
 * Plugin Name: PepScriptRX Payment Bridge
 * Description: Private, signed WooCommerce checkout bridge for PepScriptRX.
 * Version: 0.3.1
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
	const OPT                   = 'pepscriptrx_bridge_settings';
	const NS                    = 'pepscriptrx-bridge/v1';
	const DB_VERSION            = '1';
	const MAX_CALLBACK_ATTEMPTS = 8;
	/**
	 * Register WordPress and WooCommerce hooks.
	 */
	public static function boot() {

		add_action( 'plugins_loaded', array( __CLASS__, 'ensure_schema' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'status_changed' ), 10, 4 );
		add_action( 'woocommerce_order_refunded', array( __CLASS__, 'order_refunded' ), 10, 2 );
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'settings' ) );
		add_action( 'template_redirect', array( __CLASS__, 'checkout_guard' ) );
		add_action( 'wp_head', array( __CLASS__, 'noindex' ) );
		add_action( 'pepscriptrx_bridge_delete_nonce', array( __CLASS__, 'delete_nonce_lock' ) );
		add_action( 'pepscriptrx_bridge_deliver_event', array( __CLASS__, 'deliver_event' ) );
		add_action( 'pepscriptrx_bridge_notification_tick', array( __CLASS__, 'notification_tick' ) );
		add_action( 'init', array( __CLASS__, 'schedule_notification_tick' ) );
		add_action( 'admin_post_pepscriptrx_bridge_redeliver', array( __CLASS__, 'manual_redelivery' ) );
		// phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval -- Payment event delivery needs a prompt fallback when Action Scheduler is unavailable.
		add_filter( 'cron_schedules', array( __CLASS__, 'cron_schedules' ) );
		add_filter( 'woocommerce_available_payment_gateways', array( __CLASS__, 'only_mps' ) );
		add_filter( 'woocommerce_get_return_url', array( __CLASS__, 'return_url' ), 10, 2 );
	}

	/** Install or update the durable callback outbox without replaying old orders. */
	public static function ensure_schema() {

		if ( self::DB_VERSION === get_option( 'pepscriptrx_bridge_db_version' ) ) {
			return;
		}
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$table   = self::event_table();
		$charset = $wpdb->get_charset_collate();
		dbDelta(
			"CREATE TABLE {$table} (
			id bigint unsigned NOT NULL AUTO_INCREMENT,
			event_id varchar(100) NOT NULL,
			order_id bigint unsigned NOT NULL,
			callback_url varchar(500) NOT NULL,
			payload longtext NOT NULL,
			status varchar(32) NOT NULL DEFAULT 'pending',
			attempts int unsigned NOT NULL DEFAULT 0,
			last_attempt_at datetime NULL,
			next_attempt_at datetime NOT NULL,
			response_status smallint unsigned NULL,
			last_error_category varchar(100) NULL,
			locked_until datetime NULL,
			delivered_at datetime NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY event_id (event_id),
			KEY due_events (status,next_attempt_at),
			KEY order_events (order_id,created_at)
			) {$charset};"
		);
		update_option( 'pepscriptrx_bridge_db_version', self::DB_VERSION, false );
	}

	/**
	 * Return the site-prefixed durable callback table name.
	 *
	 * @return string
	 */
	private static function event_table() {

		global $wpdb;
		return $wpdb->prefix . 'psrx_bridge_events';
	}

	/**
	 * Add a one-minute fallback interval when Action Scheduler is unavailable.
	 *
	 * @param array $schedules Registered WordPress cron intervals.
	 * @return array
	 */
	public static function cron_schedules( $schedules ) {

		// phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval -- Payment event delivery needs a prompt fallback when Action Scheduler is unavailable.
		$schedules['pepscriptrx_minute'] = array(
			'interval' => 60,
			'display'  => 'Every minute',
		);
		return $schedules;
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
				'version'                     => '0.3.1',
				'configured'                  => self::configured(),
				'enabled'                     => self::enabled(),
				'processing_fee_rule'         => 'woocommerce_3_percent_v1',
				'processing_fee_basis_points' => 300,
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
		$expected_fee   = intdiv( ( $pre_fee_amount * 300 ) + 5000, 10000 );
		if ( 'woocommerce_3_percent_v1' !== $fee_rule || 300 !== $fee_basis ||
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
		$transaction_key = $order->get_transaction_id() ? substr( hash( 'sha256', $order->get_transaction_id() ), 0, 20 ) : 'no-transaction';
		self::callback( $order, $status, null, 'wc-status-' . $order_id . '-' . $to . '-' . $transaction_key );
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
		self::enqueue_callback_event( $event_id ? $event_id : 'wc-event-' . $order->get_id() . '-' . $status, $order->get_id(), $url, $payload );
	}

	/**
	 * Persist a callback before its first delivery attempt.
	 *
	 * @param string $event_id Stable event identifier.
	 * @param int    $order_id WooCommerce order identifier.
	 * @param string $url      Validated Supabase callback URL.
	 * @param string $payload  JSON callback body.
	 */
	private static function enqueue_callback_event( $event_id, $order_id, $url, $payload ) {

		global $wpdb;
		$table = self::event_table();
		$now   = current_time( 'mysql', true );
		// A direct write is required for atomic event-id deduplication in the private outbox.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (event_id,order_id,callback_url,payload,status,attempts,next_attempt_at,created_at,updated_at)
				 VALUES (%s,%d,%s,%s,'pending',0,%s,%s,%s)
				 ON DUPLICATE KEY UPDATE event_id=VALUES(event_id)",
				$event_id,
				$order_id,
				$url,
				$payload,
				$now,
				$now,
				$now
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		self::schedule_delivery( $event_id, time() );
	}

	/**
	 * Schedule one durable callback delivery without creating a payment.
	 *
	 * @param string $event_id Stable event identifier.
	 * @param int    $timestamp UTC Unix timestamp for the next attempt.
	 */
	private static function schedule_delivery( $event_id, $timestamp ) {

		$args = array( $event_id );
		if ( function_exists( 'as_schedule_single_action' ) ) {
			if ( ! function_exists( 'as_has_scheduled_action' ) || ! as_has_scheduled_action( 'pepscriptrx_bridge_deliver_event', $args, 'pepscriptrx-bridge' ) ) {
				as_schedule_single_action( $timestamp, 'pepscriptrx_bridge_deliver_event', $args, 'pepscriptrx-bridge', true );
			}
			return;
		}
		if ( ! wp_next_scheduled( 'pepscriptrx_bridge_deliver_event', $args ) ) {
			wp_schedule_single_event( $timestamp, 'pepscriptrx_bridge_deliver_event', $args );
		}
	}

	/**
	 * Claim and deliver one existing callback event.
	 *
	 * @param string $event_id Stable event identifier.
	 */
	public static function deliver_event( $event_id ) {

		global $wpdb;
		$table     = self::event_table();
		$now       = current_time( 'mysql', true );
		$locked    = gmdate( 'Y-m-d H:i:s', time() + 120 );
		$claim_sql = "UPDATE {$table} SET status='processing',attempts=attempts+1,last_attempt_at=%s,locked_until=%s,updated_at=%s
			WHERE event_id=%s AND status IN ('pending','retry') AND next_attempt_at<=%s AND (locked_until IS NULL OR locked_until<%s)";
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( $wpdb->prepare( $claim_sql, $now, $locked, $now, $event_id, $now, $now ) );
		if ( 1 !== (int) $wpdb->rows_affected ) {
			return;
		}
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE event_id=%s", $event_id ), ARRAY_A );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! $row ) {
			return;
		}
		$o       = self::options();
		$decoded = json_decode( $row['payload'], true );
		if ( ! is_array( $decoded ) ) {
			self::finish_delivery( $event_id, 'permanent_failed', null, 'invalid_persisted_payload', null );
			return;
		}
		$callback_host = strtolower( (string) wp_parse_url( $row['callback_url'], PHP_URL_HOST ) );
		if ( ! self::configured() ) {
			self::retry_or_review( $row, null, 'bridge_configuration_unavailable' );
			return;
		}
		if ( ! $callback_host || ! hash_equals( strtolower( $o['allowed_callback_host'] ), $callback_host ) ) {
			self::finish_delivery( $event_id, 'permanent_failed', null, 'invalid_callback_host', null );
			return;
		}
		$decoded['timestamp'] = time();
		$payload              = wp_json_encode( $decoded );
		$response             = wp_remote_post(
			$row['callback_url'],
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
		if ( is_wp_error( $response ) ) {
			self::retry_or_review( $row, null, 'network_or_timeout' );
			return;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code >= 200 && $code < 300 ) {
			self::finish_delivery( $event_id, 'delivered', $code, null, current_time( 'mysql', true ) );
			return;
		}
		if ( 408 === $code || 429 === $code || $code >= 500 ) {
			self::retry_or_review( $row, $code, 'temporary_http_failure' );
			return;
		}
		self::finish_delivery( $event_id, 'permanent_failed', $code, 'permanent_http_failure', null );
	}

	/**
	 * Apply bounded exponential backoff with jitter.
	 *
	 * @param array    $row      Claimed outbox row.
	 * @param int|null $code     HTTP status, when available.
	 * @param string   $category Non-sensitive failure category.
	 */
	private static function retry_or_review( $row, $code, $category ) {

		$attempts = (int) $row['attempts'];
		if ( $attempts >= self::MAX_CALLBACK_ATTEMPTS ) {
			self::finish_delivery( $row['event_id'], 'manual_review', $code, 'retry_limit_exhausted', null );
			return;
		}
		$delay = min( 21600, 30 * ( 2 ** max( 0, $attempts - 1 ) ) ) + wp_rand( 0, 15 );
		$next  = gmdate( 'Y-m-d H:i:s', time() + $delay );
		self::finish_delivery( $row['event_id'], 'retry', $code, $category, null, $next );
		self::schedule_delivery( $row['event_id'], time() + $delay );
	}

	/**
	 * Persist the terminal or retry state for a claimed event.
	 *
	 * @param string      $event_id       Stable event identifier.
	 * @param string      $status         Durable delivery status.
	 * @param int|null    $code           HTTP status, when available.
	 * @param string|null $category       Non-sensitive failure category.
	 * @param string|null $delivered_at   UTC delivery timestamp.
	 * @param string|null $next_attempt_at UTC next-attempt timestamp.
	 */
	private static function finish_delivery( $event_id, $status, $code, $category, $delivered_at, $next_attempt_at = null ) {

		global $wpdb;
		$table = self::event_table();
		$now   = current_time( 'mysql', true );
		$next  = $next_attempt_at ? $next_attempt_at : $now;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status=%s,response_status=%d,last_error_category=%s,delivered_at=%s,next_attempt_at=%s,locked_until=NULL,updated_at=%s WHERE event_id=%s",
				$status,
				(int) $code,
				$category,
				$delivered_at,
				$next,
				$now,
				$event_id
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/** Keep a durable scheduler tick active for the Supabase notification outbox. */
	public static function schedule_notification_tick() {

		if ( ! self::configured() ) {
			return;
		}
		if ( function_exists( 'as_schedule_recurring_action' ) ) {
			if ( ! function_exists( 'as_has_scheduled_action' ) || ! as_has_scheduled_action( 'pepscriptrx_bridge_notification_tick', array(), 'pepscriptrx-bridge' ) ) {
				as_schedule_recurring_action( time() + 60, 60, 'pepscriptrx_bridge_notification_tick', array(), 'pepscriptrx-bridge', true );
			}
			return;
		}
		if ( ! wp_next_scheduled( 'pepscriptrx_bridge_notification_tick' ) ) {
			wp_schedule_event( time() + 60, 'pepscriptrx_minute', 'pepscriptrx_bridge_notification_tick' );
		}
	}

	/** Trigger the server-side notification worker; this never creates an order or payment. */
	public static function notification_tick() {

		$o    = self::options();
		$host = strtolower( trim( (string) $o['allowed_callback_host'] ) );
		if ( ! $host || ! self::configured() ) {
			return;
		}
		$url     = 'https://' . $host . '/functions/v1/process-payment-notification-outbox';
		$payload = wp_json_encode(
			array(
				'timestamp' => time(),
				'nonce'     => wp_generate_uuid4(),
				'limit'     => 10,
			)
		);
		wp_remote_post(
			$url,
			array(
				'timeout' => 20,
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
	 * Safely requeue an existing terminal or failed event for manual redelivery.
	 */
	public static function manual_redelivery() {

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( 'Unauthorized', 403 );
		}
		$event_id = sanitize_text_field( wp_unslash( $_POST['event_id'] ?? '' ) );
		check_admin_referer( 'pepscriptrx_bridge_redeliver_' . $event_id );
		global $wpdb;
		$table = self::event_table();
		$now   = current_time( 'mysql', true );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET status='pending',next_attempt_at=%s,locked_until=NULL,last_error_category='manual_redelivery_requested',updated_at=%s WHERE event_id=%s AND status IN ('retry','permanent_failed','manual_review')",
				$now,
				$now,
				$event_id
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( 1 === (int) $wpdb->rows_affected ) {
			self::schedule_delivery( $event_id, time() );
		}
		wp_safe_redirect( admin_url( 'admin.php?page=pepscriptrx-bridge' ) );
		exit;
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
		</table><?php submit_button(); ?></form>
		<h2>Callback delivery</h2>
		<p>Retries reuse the existing signed callback event and never create a WooCommerce order or processor transaction.</p>
		<?php
		global $wpdb;
		$table = self::event_table();
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		$events = $wpdb->get_results( "SELECT event_id,order_id,status,attempts,last_attempt_at,next_attempt_at,response_status,last_error_category,delivered_at FROM {$table} ORDER BY id DESC LIMIT 50", ARRAY_A );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		?>
		<table class="widefat striped"><thead><tr><th>Event</th><th>Order</th><th>Status</th><th>Attempts</th><th>Last / next attempt</th><th>Response</th><th>Action</th></tr></thead><tbody>
		<?php
		foreach ( $events as $event ) :
			?>
		<tr>
		<td><?php echo esc_html( $event['event_id'] ); ?></td><td><?php echo esc_html( $event['order_id'] ); ?></td>
		<td><?php echo esc_html( $event['status'] ); ?></td><td><?php echo esc_html( $event['attempts'] ); ?></td>
		<td><?php echo esc_html( ( ! empty( $event['last_attempt_at'] ) ? $event['last_attempt_at'] : '-' ) . ' / ' . ( ! empty( $event['next_attempt_at'] ) ? $event['next_attempt_at'] : '-' ) ); ?></td>
		<td><?php echo esc_html( ( ! empty( $event['response_status'] ) ? $event['response_status'] : '-' ) . ' ' . ( ! empty( $event['last_error_category'] ) ? $event['last_error_category'] : '' ) ); ?></td>
		<td>
			<?php
			if ( 'delivered' !== $event['status'] ) :
				?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="pepscriptrx_bridge_redeliver"><input type="hidden" name="event_id" value="<?php echo esc_attr( $event['event_id'] ); ?>">
				<?php wp_nonce_field( 'pepscriptrx_bridge_redeliver_' . $event['event_id'] ); ?><button class="button">Redeliver existing event</button></form>
			<?php endif; ?></td>
		</tr>
		<?php endforeach; ?>
		<?php
		if ( empty( $events ) ) :
			?>
			<tr><td colspan="7">No callback events recorded.</td></tr><?php endif; ?>
		</tbody></table></div>

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
register_activation_hook( __FILE__, array( 'PepScriptRX_Payment_Bridge', 'ensure_schema' ) );
PepScriptRX_Payment_Bridge::boot();
