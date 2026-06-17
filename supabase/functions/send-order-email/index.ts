import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type EmailType = 'order_confirmation' | 'shipping_confirmation';

type OrderItem = {
  name?: string;
  product_name?: string;
  strength?: string;
  price?: number;
  quantity?: number;
};

type OrderRecord = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  order_number?: string | null;
  order_items?: OrderItem[] | null;
  order_total?: number | null;
  quoted_price?: number | null;
  shipping_cost?: number | null;
  discount_amount?: number | null;
  medication?: string | null;
  product_name?: string | null;
  referral_code?: string | null;
  discount_code?: string | null;
  checkout_scope_code?: string | null;
  source_portal?: string | null;
  source_rep?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  locale?: string | null;
  tracking_carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { type, force = false, record } = await req.json() as {
      type: EmailType;
      force?: boolean;
      record: OrderRecord;
    };

    if (!record?.id) return json({ error: 'record.id is required' }, 400);
    if (type !== 'order_confirmation' && type !== 'shipping_confirmation') {
      return json({ error: 'Unsupported email type' }, 400);
    }

    const db = getDb();
    const authError = await requireRole(req, db, ['admin', 'rx_plus_admin']);
    if (authError) return authError;

    const trustedRecord = await getOrderRecord(db, record.id);
    if (!trustedRecord?.email) return json({ skipped: 'missing customer email' }, 200);

    const existingSentAt = await getExistingSentAt(db, trustedRecord.id, type);
    if (existingSentAt && !force) {
      return json({ skipped: 'email already sent', sent_at: existingSentAt }, 200);
    }

    const message = buildEmail(type, trustedRecord);
    const apiKey = Deno.env.get('EMAIL_PROVIDER_API_KEY') ?? Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('NOTIFY_FROM') ?? 'PepScriptRX Support <service@pepscriptrx.com>';

    if (!apiKey) return json({ error: 'EMAIL_PROVIDER_API_KEY or RESEND_API_KEY is not configured' }, 500);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [trustedRecord.email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: data }, 500);

    const sentAt = new Date().toISOString();
    await markEmailSent(db, trustedRecord.id, type, sentAt);

    return json({ ok: true, id: data.id, type, sent_at: sentAt });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function getDb() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, serviceKey);
}

async function getExistingSentAt(db: ReturnType<typeof getDb>, submissionId: string, type: EmailType) {
  const column = type === 'order_confirmation' ? 'confirmation_email_sent_at' : 'shipping_email_sent_at';
  const { data, error } = await db
    .from('patient_submissions')
    .select(column)
    .eq('id', submissionId)
    .maybeSingle();

  if (error) throw new Error(`Email status lookup failed: ${error.message}`);
  return (data as Record<string, string | null> | null)?.[column] ?? null;
}

async function markEmailSent(db: ReturnType<typeof getDb>, submissionId: string, type: EmailType, sentAt: string) {
  const column = type === 'order_confirmation' ? 'confirmation_email_sent_at' : 'shipping_email_sent_at';
  const { error } = await db
    .from('patient_submissions')
    .update({ [column]: sentAt, updated_at: sentAt })
    .eq('id', submissionId);

  if (error) throw new Error(`Email sent marker update failed: ${error.message}`);
}

async function getOrderRecord(db: ReturnType<typeof getDb>, submissionId: string): Promise<OrderRecord | null> {
  const { data, error } = await db
    .from('patient_submissions')
    .select(`
      id,
      email,
      full_name,
      order_number,
      order_items,
      order_total,
      quoted_price,
      shipping_cost,
      discount_amount,
      medication,
      product_name,
      referral_code,
      discount_code,
      checkout_scope_code,
      source_portal,
      source_rep,
      store_slug,
      store_name,
      locale,
      tracking_carrier,
      tracking_number,
      tracking_url
    `)
    .eq('id', submissionId)
    .maybeSingle();

  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data as OrderRecord | null;
}

function buildEmail(type: EmailType, record: OrderRecord) {
  const supportPhone = Deno.env.get('SUPPORT_PHONE') ?? '(818) 864-0472';
  const supportEmail = Deno.env.get('SUPPORT_EMAIL') ?? 'service@pepscriptrx.com';
  const appUrl = trimTrailingSlash(Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://pepscriptrx.vercel.app');
  const firstName = getFirstName(record.full_name);
  const orderNumber = record.order_number || `PSRX-${record.id.slice(0, 8).toUpperCase()}`;
  const itemLines = normalizeItems(record).map(formatItem);
  const total = money(getOrderTotal(record));
  const portalLine = getPortalLine(record);
  const trackingUrl = record.tracking_url || buildTrackingUrl(record.tracking_carrier, record.tracking_number);
  const isAnatolia = isAnatoliaOrder(record);
  const brandName = isAnatolia ? 'Anatolia Wellness Labs' : 'PepScriptRX';

  if (type === 'shipping_confirmation') {
    if (isAnatolia) {
      const text = [
        `Merhaba ${firstName},`,
        '',
        'Güzel haber - Anatolia Wellness Labs siparişiniz kargoya verildi.',
        '',
        `Sipariş Numarası: ${orderNumber}`,
        '',
        `Kargo Firması: ${record.tracking_carrier || 'Kargo bilgisi bekleniyor'}`,
        `Takip Numarası: ${record.tracking_number || 'Takip bilgisi bekleniyor'}`,
        '',
        `Gönderinizi buradan takip edebilirsiniz: ${trackingUrl || `${appUrl}/anatolia`}`,
        '',
        'Gönderilen Ürünler:',
        ...itemLines,
        '',
        'Yardıma ihtiyacınız olursa bize ulaşabilirsiniz:',
        `Telefon: ${supportPhone}`,
        `E-posta: ${supportEmail}`,
        '',
        'Anatolia Wellness Labs powered by PepScriptRX',
      ].join('\n');

      return {
        subject: 'Anatolia Wellness Labs siparişiniz kargoya verildi',
        text,
        html: layout({
          title: 'Siparişiniz kargoya verildi',
          intro: `Merhaba ${escapeHtml(firstName)}, güzel haber - Anatolia Wellness Labs siparişiniz kargoya verildi.`,
          orderNumber,
          itemLines,
          total,
          portalLine,
          supportPhone,
          supportEmail,
          appUrl,
          trackingCarrier: record.tracking_carrier || 'Kargo bilgisi bekleniyor',
          trackingNumber: record.tracking_number || 'Takip bilgisi bekleniyor',
          trackingUrl,
          ctaText: 'Siparişi Takip Et',
          ctaUrl: trackingUrl || `${appUrl}/anatolia`,
          brandName,
          locale: 'tr',
        }),
      };
    }

    const text = [
      `Hi ${firstName},`,
      '',
      'Good news - your PepScriptRX order has shipped.',
      '',
      `Order Number: ${orderNumber}`,
      '',
      `Carrier: ${record.tracking_carrier || 'Carrier pending'}`,
      `Tracking Number: ${record.tracking_number || 'Tracking pending'}`,
      '',
      `Track your shipment here: ${trackingUrl || appUrl}`,
      '',
      'Items Shipped:',
      ...itemLines,
      '',
      'Need help? Contact us anytime:',
      `Phone: ${supportPhone}`,
      `Email: ${supportEmail}`,
      `App: ${appUrl}`,
      '',
      'Thank you again for your purchase.',
      '',
      'PepScriptRX Support',
    ].join('\n');

    return {
      subject: 'Your PepScriptRX order has shipped',
      text,
      html: layout({
        title: 'Your order has shipped',
        intro: `Hi ${escapeHtml(firstName)}, good news - your PepScriptRX order has shipped.`,
        orderNumber,
        itemLines,
        total,
        portalLine,
        supportPhone,
        supportEmail,
        appUrl,
        trackingCarrier: record.tracking_carrier || 'Carrier pending',
        trackingNumber: record.tracking_number || 'Tracking pending',
        trackingUrl,
        ctaText: 'Track Order',
        ctaUrl: trackingUrl || appUrl,
        brandName,
      }),
    };
  }

  if (isAnatolia) {
    const text = [
      `Merhaba ${firstName},`,
      '',
      'Anatolia Wellness Labs siparişiniz için teşekkür ederiz. Siparişiniz alındı ve işleme hazırlanıyor.',
      '',
      `Sipariş Numarası: ${orderNumber}`,
      '',
      'Sipariş Edilen Ürünler:',
      ...itemLines,
      '',
      `Sipariş Toplamı: ${total}`,
      portalLine ? `\n${portalLine}` : '',
      '',
      'Takip bilgileriniz hazır olduğunda size ayrıca e-posta göndereceğiz.',
      '',
      'Yardıma ihtiyacınız olursa bize ulaşabilirsiniz:',
      `Telefon: ${supportPhone}`,
      `E-posta: ${supportEmail}`,
      '',
      'Anatolia Wellness Labs powered by PepScriptRX',
    ].join('\n');

    return {
      subject: 'Anatolia Wellness Labs siparişiniz alındı',
      text,
      html: layout({
        title: 'Siparişiniz alındı',
        intro: `Merhaba ${escapeHtml(firstName)}, Anatolia Wellness Labs siparişiniz alındı ve işleme hazırlanıyor.`,
        orderNumber,
        itemLines,
        total,
        portalLine,
        supportPhone,
        supportEmail,
        appUrl,
        ctaText: 'Anatolia Mağazasını Aç',
        ctaUrl: `${appUrl}/anatolia`,
        brandName,
        locale: 'tr',
      }),
    };
  }

  const text = [
    `Hi ${firstName},`,
    '',
    'Thank you for your order with PepScriptRX. Your order has been received and is now being prepared for processing.',
    '',
    `Order Number: ${orderNumber}`,
    '',
    'Items Ordered:',
    ...itemLines,
    '',
    `Order Total: ${total}`,
    portalLine ? `\n${portalLine}` : '',
    '',
    "You'll receive another email as soon as your tracking information is available.",
    '',
    'Need help? Contact us anytime:',
    `Phone: ${supportPhone}`,
    `Email: ${supportEmail}`,
    `App: ${appUrl}`,
    '',
    'Thank you for choosing PepScriptRX.',
    '',
    'PepScriptRX Support',
  ].join('\n');

  return {
    subject: 'Thank you for your PepScriptRX order',
    text,
    html: layout({
      title: 'Thank you for your order',
      intro: `Hi ${escapeHtml(firstName)}, thank you for your order with PepScriptRX. Your order has been received and is now being prepared for processing.`,
      orderNumber,
      itemLines,
      total,
      portalLine,
      supportPhone,
      supportEmail,
      appUrl,
      ctaText: 'Open PepScriptRX',
      ctaUrl: appUrl,
      brandName,
    }),
  };
}

function layout(args: {
  title: string;
  intro: string;
  orderNumber: string;
  itemLines: string[];
  total: string;
  portalLine: string;
  supportPhone: string;
  supportEmail: string;
  appUrl: string;
  trackingCarrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  ctaText: string;
  ctaUrl: string;
  brandName?: string;
  locale?: 'en' | 'tr';
}) {
  const isTurkish = args.locale === 'tr';
  const labels = isTurkish
    ? {
        details: 'Sipariş Detayları',
        orderNumber: 'Sipariş Numarası',
        orderTotal: 'Sipariş Toplamı',
        items: 'Ürünler',
        shipping: 'Kargo',
        carrier: 'Kargo Firması',
        trackingNumber: 'Takip Numarası',
        trackingLink: 'Takip Bağlantısı',
        updateLine: 'Siparişiniz işlem ve teslimat aşamalarında güncellenecektir.',
        support: 'Yardıma ihtiyacınız mı var?',
        phone: 'Telefon',
        email: 'E-posta',
        app: 'Uygulama',
        footer: 'Anatolia Wellness Labs, PepScriptRX platformu tarafından desteklenir. Ürün bulunurluğu, hazırlık süreleri ve kargo güncellemeleri değişebilir.',
      }
    : {
        details: 'Order Details',
        orderNumber: 'Order Number',
        orderTotal: 'Order Total',
        items: 'Items',
        shipping: 'Shipping',
        carrier: 'Carrier',
        trackingNumber: 'Tracking Number',
        trackingLink: 'Tracking Link',
        updateLine: "You'll receive updates as your order moves through processing and fulfillment.",
        support: 'Need help?',
        phone: 'Phone',
        email: 'Email',
        app: 'App',
        footer: 'PepScriptRX provides access to wellness products through its platform. Product availability, fulfillment timelines, and shipping updates may vary. Please contact support with any questions about your order.',
      };
  const trackingBlock = args.trackingNumber ? `
    <div class="card">
      <div class="label">${escapeHtml(labels.shipping)}</div>
      <table>
        <tr><td>${escapeHtml(labels.carrier)}</td><td><strong>${escapeHtml(args.trackingCarrier ?? (isTurkish ? 'Kargo bilgisi bekleniyor' : 'Carrier pending'))}</strong></td></tr>
        <tr><td>${escapeHtml(labels.trackingNumber)}</td><td><strong>${escapeHtml(args.trackingNumber)}</strong></td></tr>
        ${args.trackingUrl ? `<tr><td>${escapeHtml(labels.trackingLink)}</td><td><a href="${escapeAttr(args.trackingUrl)}">${escapeHtml(args.trackingUrl)}</a></td></tr>` : ''}
      </table>
    </div>` : '';

  return `<!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { margin:0; background:#eef4f7; font-family: Arial, Helvetica, sans-serif; color:#102033; }
        .wrap { max-width:640px; margin:0 auto; padding:28px 16px; }
        .panel { background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #dce8ee; box-shadow:0 20px 50px rgba(7,24,38,.10); }
        .hero { background:#071422; padding:30px 28px; color:#fff; }
        .brand { color:#21c7d9; font-weight:800; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
        h1 { margin:12px 0 0; font-size:28px; line-height:1.15; }
        .content { padding:28px; }
        p { line-height:1.6; color:#435466; }
        .card { border:1px solid #dce8ee; border-radius:14px; padding:18px; margin:18px 0; background:#f8fbfc; }
        .label { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#059bad; margin-bottom:10px; }
        table { width:100%; border-collapse:collapse; }
        td { padding:9px 0; border-bottom:1px solid #e7eef2; vertical-align:top; color:#405164; }
        td:last-child { text-align:right; color:#102033; }
        ul { padding-left:20px; color:#102033; line-height:1.7; }
        .portal { background:#e8fbfd; color:#075b67; border:1px solid #b7f0f6; border-radius:12px; padding:12px 14px; font-weight:700; font-size:14px; }
        .btn { display:inline-block; background:#08a8b8; color:#fff !important; text-decoration:none; padding:14px 20px; border-radius:10px; font-weight:800; margin:10px 0 18px; }
        .support { color:#435466; font-size:14px; line-height:1.7; }
        .footer { padding:18px 28px 26px; color:#6d7b89; font-size:12px; line-height:1.6; background:#f8fbfc; }
        a { color:#078fa0; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="panel">
          <div class="hero">
            <div class="brand">${escapeHtml(args.brandName ?? 'PepScriptRX')}</div>
            <h1>${escapeHtml(args.title)}</h1>
          </div>
          <div class="content">
            <p>${args.intro}</p>
            ${args.portalLine ? `<div class="portal">${escapeHtml(args.portalLine)}</div>` : ''}
            <div class="card">
              <div class="label">${escapeHtml(labels.details)}</div>
              <table>
                <tr><td>${escapeHtml(labels.orderNumber)}</td><td><strong>${escapeHtml(args.orderNumber)}</strong></td></tr>
                <tr><td>${escapeHtml(labels.orderTotal)}</td><td><strong>${escapeHtml(args.total)}</strong></td></tr>
              </table>
              <div class="label" style="margin-top:16px;">${escapeHtml(labels.items)}</div>
              <ul>${args.itemLines.map((item) => `<li>${escapeHtml(item.replace(/^- /, ''))}</li>`).join('')}</ul>
            </div>
            ${trackingBlock}
            <p>${escapeHtml(labels.updateLine)}</p>
            <a class="btn" href="${escapeAttr(args.ctaUrl)}">${escapeHtml(args.ctaText)}</a>
            <div class="support">
              <strong>${escapeHtml(labels.support)}</strong><br>
              ${escapeHtml(labels.phone)}: ${escapeHtml(args.supportPhone)}<br>
              ${escapeHtml(labels.email)}: <a href="mailto:${escapeAttr(args.supportEmail)}">${escapeHtml(args.supportEmail)}</a><br>
              ${escapeHtml(labels.app)}: <a href="${escapeAttr(args.appUrl)}">${escapeHtml(args.appUrl)}</a>
            </div>
          </div>
          <div class="footer">
            ${escapeHtml(labels.footer)}
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

function normalizeItems(record: OrderRecord): OrderItem[] {
  const items = Array.isArray(record.order_items) ? record.order_items.filter(Boolean) : [];
  if (items.length > 0) return items;
  return [{
    name: record.product_name || record.medication || 'PepScriptRX order',
    price: record.quoted_price ?? record.order_total ?? 0,
    quantity: 1,
  }];
}

function formatItem(item: OrderItem) {
  const name = item.name || item.product_name || 'PepScriptRX order';
  const strength = item.strength && item.strength !== 'Standard' ? ` ${item.strength}` : '';
  const qty = item.quantity && item.quantity > 1 ? ` x${item.quantity}` : '';
  const price = typeof item.price === 'number' && item.price > 0 ? ` - ${money(item.price)}` : '';
  return `- ${name}${strength}${qty}${price}`;
}

function getOrderTotal(record: OrderRecord) {
  if (typeof record.order_total === 'number') return record.order_total;
  return Math.max(0, Number(record.quoted_price ?? 0) + Number(record.shipping_cost ?? 0) - Number(record.discount_amount ?? 0));
}

function getPortalLine(record: OrderRecord) {
  if (isAnatoliaOrder(record)) {
    return 'Siparişiniz Anatolia Wellness Labs üzerinden, PepScriptRX güvencesiyle verilmiştir.';
  }
  if (record.referral_code === 'MARK65' || record.discount_code === 'MARK65') {
    return 'Your order was placed through Empire Health & Wellness powered by PepScriptRX.';
  }
  if (isEhwSubOrder(record)) {
    return 'Your order was placed through Ellie powered by PepScriptRX.';
  }
  if (record.referral_code === 'ALPHAPRIDE' || record.discount_code === 'ALPHAPRIDE') {
    return 'Your order was placed through Alpha Pride Wellness powered by PepScriptRX.';
  }
  if (record.referral_code) return `Your order was placed through referral portal ${record.referral_code}.`;
  return '';
}

function isAnatoliaOrder(record: OrderRecord) {
  const values = [
    record.locale,
    record.store_slug,
    record.store_name,
    record.source_portal,
    record.checkout_scope_code,
  ].map((value) => String(value ?? '').trim().toLowerCase());

  return values.includes('tr')
    || values.includes('anatolia')
    || values.some((value) => value.includes('anatolia wellness labs'));
}

function isEhwSubOrder(record: OrderRecord) {
  const values = [
    record.referral_code,
    record.checkout_scope_code,
    record.source_portal,
    record.source_rep,
    record.store_slug,
  ].map((value) => String(value ?? '').trim().toUpperCase());

  if (values.includes('EHWSUB')) return true;
  return record.discount_code === 'PEP10'
    && String(record.store_name ?? '').trim().toLowerCase() === 'ellie';
}

function buildTrackingUrl(carrier?: string | null, trackingNumber?: string | null) {
  if (!trackingNumber) return '';
  const encoded = encodeURIComponent(trackingNumber);
  const normalized = (carrier ?? '').toLowerCase();
  if (normalized.includes('ups')) return `https://www.ups.com/track?tracknum=${encoded}`;
  if (normalized.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  if (normalized.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  if (normalized.includes('dhl')) return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encoded}`;
  return '';
}

function getFirstName(name?: string | null) {
  return (name ?? '').trim().split(/\s+/)[0] || 'there';
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function requireRole(
  req: Request,
  db: ReturnType<typeof getDb>,
  allowedRoles: string[],
) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing authorization token' }, 401);

  const { data: authData, error: authError } = await db.auth.getUser(token);
  const userId = authData.user?.id;
  if (authError || !userId) return json({ error: 'Invalid authorization token' }, 401);

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .or(`auth_user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle();

  if (profileError || !profile || !allowedRoles.includes(String(profile.role))) {
    return json({ error: 'Forbidden' }, 403);
  }

  return null;
}
