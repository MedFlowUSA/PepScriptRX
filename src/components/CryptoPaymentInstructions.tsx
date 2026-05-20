import { useState } from 'react';
import { PHONE_DISPLAY, PHONE_HREF } from '../config';

const WALLETS = [
  {
    id: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin Network',
    address: '32oVc2p7FRgK16L7ZEfGxciskpcQxM7RLA',
    tag: null,
    color: '#F7931A',
  },
  {
    id: 'ETH',
    name: 'Ethereum',
    network: 'ERC-20',
    address: '0xfd5F994c0a400073dF3E53392d8F5D8F0faac8DD',
    tag: null,
    color: '#627EEA',
  },
  {
    id: 'USDT',
    name: 'Tether (USDT)',
    network: 'ERC-20',
    address: '0xfd5F994c0a400073dF3E53392d8F5D8F0faac8DD',
    tag: null,
    color: '#26A17B',
  },
  {
    id: 'XRP',
    name: 'XRP',
    network: 'XRP Ledger',
    address: 'rB1kVfLSxpXCw7sLCBcm5LFZYzkS6xmwSK',
    tag: '2542538289',
    color: '#00AAE4',
  },
] as const;

interface Props {
  totalUsd?: number;
  expectedAssetAmount?: number | null;
  selectedAsset?: string | null;
}

export default function CryptoPaymentInstructions({ totalUsd, expectedAssetAmount, selectedAsset }: Props) {
  const defaultWallet = selectedAsset ? WALLETS.find(w => w.id === selectedAsset) ?? WALLETS[0] : WALLETS[0];
  const [active, setActive] = useState(defaultWallet.id);
  const [copied, setCopied] = useState<string | null>(null);

  const wallet = WALLETS.find(w => w.id === active) ?? WALLETS[0];

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>

      {/* Header warning */}
      <div style={{ background: '#1a2332', padding: '18px 20px' }}>
        <div style={{ fontWeight: 700, color: '#fff', fontSize: 15, marginBottom: 6 }}>
          Pay with Cryptocurrency
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.6 }}>
          Send crypto only after your order has been approved. Use the exact network shown.
          Sending to the wrong network may result in permanent loss.
        </div>
      </div>

      {/* Asset tabs */}
      <div style={{ display: 'flex', background: '#f5f7fa', borderBottom: '1px solid var(--border)' }}>
        {WALLETS.map(w => (
          <button
            key={w.id}
            onClick={() => setActive(w.id)}
            style={{
              flex: 1,
              padding: '12px 4px',
              border: 'none',
              borderBottom: active === w.id ? `3px solid ${w.color}` : '3px solid transparent',
              background: 'transparent',
              fontWeight: active === w.id ? 700 : 500,
              fontSize: 13,
              color: active === w.id ? '#1a2332' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            {w.id}
          </button>
        ))}
      </div>

      {/* Active wallet detail */}
      <div style={{ padding: '20px 20px 24px' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{wallet.name}</div>
          <span style={{ display: 'inline-block', background: `${wallet.color}22`, color: wallet.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, border: `1px solid ${wallet.color}44` }}>
            {wallet.network}
          </span>
        </div>

        {/* Amount */}
        {(totalUsd || expectedAssetAmount) && (
          <div style={{ background: 'var(--teal-pale)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Amount due</div>
            <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 18 }}>
              {expectedAssetAmount ? `${expectedAssetAmount} ${wallet.id}` : `$${totalUsd?.toFixed(2)} USD`}
            </div>
            {expectedAssetAmount && totalUsd && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>(≈ ${totalUsd.toFixed(2)} USD)</div>
            )}
          </div>
        )}

        {/* Address */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Wallet Address
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: 13,
              padding: '10px 12px',
              background: '#f5f7fa',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              wordBreak: 'break-all',
              color: '#1a2332',
              lineHeight: 1.5,
            }}>
              {wallet.address}
            </div>
            <button
              onClick={() => copy(wallet.address, 'addr')}
              style={{
                flexShrink: 0,
                padding: '10px 14px',
                background: copied === 'addr' ? 'var(--success)' : 'var(--ink)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {copied === 'addr' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* XRP destination tag */}
        {wallet.tag && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Destination Tag (required)
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: 18,
                  fontWeight: 800,
                  padding: '10px 12px',
                  background: '#fff5f5',
                  border: '2px solid #ef4444',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ef4444',
                }}>
                  {wallet.tag}
                </div>
                <button
                  onClick={() => copy(wallet.tag!, 'tag')}
                  style={{
                    flexShrink: 0,
                    padding: '10px 14px',
                    background: copied === 'tag' ? 'var(--success)' : '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied === 'tag' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* XRP red warning */}
            <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13, marginBottom: 4 }}>
                XRP Destination Tag Required
              </div>
              <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
                XRP payments require both the wallet address and destination tag. Payments sent without the correct destination tag may be lost.
              </div>
            </div>
          </>
        )}

        {/* After sending instructions */}
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          After sending, please call or text us at{' '}
          <a href={PHONE_HREF} style={{ color: 'var(--teal)', fontWeight: 600 }}>{PHONE_DISPLAY}</a>
          {' '}with your transaction hash (TX ID) so we can confirm your payment.
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ background: '#f9fafb', borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <strong>Crypto Payment Disclaimer:</strong> Crypto payments are accepted only for approved orders. Customer must send the exact amount and correct network. PepScriptRX is not responsible for payments sent to the wrong address, wrong network, missing XRP destination tag, duplicate payments, underpayments, overpayments, network fees, or blockchain delays. Crypto payments are final once confirmed on-chain. Refunds, if approved, may be issued based on the original USD order value, not market movement.
        </div>
      </div>
    </div>
  );
}
