export const PEPRXBOT_IMAGE = '/marketing/peprxbot.png';

export const PEPRXBOT_OPENING_MESSAGE =
  "Hi, I'm PEPRXbot - your AI shopping and mixing assistant. I can help you compare product categories, find supplies, upload receipts, use the mixing calculator, and complete checkout. I can't provide medical advice, prescribe, diagnose, or recommend treatment. What do you need help with today?";

export const PEPRXBOT_DISCLAIMER =
  'PEPRXbot provides general education, shopping support, and calculator guidance only. It does not provide medical advice, diagnosis, prescriptions, or treatment recommendations. Please consult a licensed medical provider for medical decisions.';

export const PEPRXBOT_SHORT_DISCLAIMER = 'General education and shopping support only. Not medical advice.';

export const PEPRXBOT_FALLBACK =
  'I can help with shopping, product education, supplies, mixing calculator math, and checkout navigation. I cannot provide medical advice, prescribe, diagnose, or recommend treatment. Please consult a licensed medical provider for personal medical decisions.';

export type PepRxBotTopic =
  | 'shopping'
  | 'compare'
  | 'mixing'
  | 'supplies'
  | 'receipt'
  | 'checkout'
  | 'support'
  | 'portal'
  | 'product';

export const PEPRXBOT_QUICK_ACTIONS: Array<{ id: PepRxBotTopic; label: string }> = [
  { id: 'shopping', label: 'Help me shop' },
  { id: 'compare', label: 'Compare product categories' },
  { id: 'mixing', label: 'Need help mixing' },
  { id: 'supplies', label: 'Find supplies' },
  { id: 'receipt', label: 'Upload receipt' },
  { id: 'checkout', label: 'Checkout help' },
  { id: 'support', label: 'Track/support' },
  { id: 'portal', label: 'Rep/admin help' },
];

export const PEPRXBOT_TOPIC_ANSWERS: Record<PepRxBotTopic, { title: string; answer: string; cta?: string; href?: string }> = {
  shopping: {
    title: 'Shopping help',
    answer:
      'PEPRXbot can help you narrow the catalog by general category, compare listed vial sizes and prices, find supplies, and move into checkout. It cannot tell you what to take or what is medically appropriate.',
    cta: 'Shop available products',
    href: '/start',
  },
  compare: {
    title: 'Compare product categories',
    answer:
      'Trizep, Sema, and Reta are commonly discussed in the weight-management peptide category. PEPRXbot can compare listed product sizes, pricing, and checkout options, but a licensed provider should decide what is appropriate for you.',
    cta: 'Open product library',
    href: '/library',
  },
  mixing: {
    title: 'Mixing calculator guidance',
    answer:
      'Enter the vial strength, the amount of BAC water added, and the provider-directed amount you are calculating. The calculator helps with concentration math and syringe-unit conversion. It does not decide or recommend your dose.',
    cta: 'Open Mixing Calculator',
    href: '/mixing',
  },
  supplies: {
    title: 'Supply help',
    answer:
      'Many customers look for BAC water and insulin syringes when they do not already have supplies. PEPRXbot can help you find available supply kits, but preparation and use should follow your provider or pharmacy instructions.',
    cta: 'Find supplies',
    href: '/start?product=bac-water',
  },
  receipt: {
    title: 'Receipt upload help',
    answer:
      'Upload a clear image or PDF of your qualifying prior receipt when prompted. Make sure the product, date, and amount are visible when possible. Uploading a receipt may pause payment while the discount is reviewed.',
    cta: 'Start receipt review',
    href: '/start',
  },
  checkout: {
    title: 'Checkout help',
    answer:
      'Review your cart, confirm the correct storefront or account code, enter accurate contact and shipping details, and follow the payment instructions shown after submission. Keep your order reference for support.',
    cta: 'Go to checkout',
    href: '/start',
  },
  support: {
    title: 'Tracking and support',
    answer:
      'Tracking is usually provided after processing. Make sure your email and phone are correct. If you need order-specific help, use the support contact on your confirmation or customer portal.',
    cta: 'Customer login',
    href: '/login?portal=patient',
  },
  portal: {
    title: 'Portal helper',
    answer:
      'A portal is a branded storefront or tracking link connected to a representative, admin, or partner. It helps customers shop while keeping checkout attribution attached to the correct account.',
    cta: 'Rep/admin login',
    href: '/login?portal=rep',
  },
  product: {
    title: 'Product education',
    answer:
      'PEPRXbot can explain listed product categories, vial sizes, supply needs, and pricing. It cannot recommend a product, diagnose a condition, promise results, or provide personalized medical guidance.',
    cta: 'Open product library',
    href: '/library',
  },
};
