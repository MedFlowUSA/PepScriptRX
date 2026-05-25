export const PHONE_DISPLAY = '(818) 864-0472';
export const PHONE_HREF    = 'tel:+18188640472';
export const EMAIL_SUPPORT = 'info@pepscriptrx.com';
export const EMAIL_NOTIFY  = 'info@4lifequote.com';
export const ADDRESS_LINE1 = 'Nationwide Shipment';
export const ADDRESS_LINE2 = '';
export const PAYPAL_ME     = 'https://paypal.me/PepScriptRX';

export const CRYPTO_WALLETS = {
  BTC:  { address: '32oVc2p7FRgK16L7ZEfGxciskpcQxM7RLA',          tag: null,         network: 'Bitcoin Network', color: '#F7931A', name: 'Bitcoin' },
  ETH:  { address: '0xfd5F994c0a400073dF3E53392d8F5D8F0faac8DD',  tag: null,         network: 'ERC-20',         color: '#627EEA', name: 'Ethereum' },
  USDT: { address: '0xfd5F994c0a400073dF3E53392d8F5D8F0faac8DD',  tag: null,         network: 'ERC-20',         color: '#26A17B', name: 'Tether (USDT)' },
  XRP:  { address: 'rB1kVfLSxpXCw7sLCBcm5LFZYzkS6xmwSK',          tag: '2542538289', network: 'XRP Ledger',     color: '#00AAE4', name: 'XRP' },
} as const;
