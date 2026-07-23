export type PepRxBotFaq = {
  question: string;
  answer: string;
};

export type PepRxBotFaqCategory = {
  category: string;
  items: PepRxBotFaq[];
};

export const PEPRXBOT_FAQ_CATEGORIES: PepRxBotFaqCategory[] = [
  {
    category: 'Shopping Help',
    items: [
      {
        question: 'What can PEPRXbot help me with?',
        answer:
          'PEPRXbot can help you navigate PepScriptRX, find listed products and supplies, use the arithmetic-only Mixing Calculator, upload receipts, understand checkout, and locate support. PEPRXbot does not compare treatments or provide medical, dosing, preparation, prescription, diagnosis, or treatment advice.',
      },
      {
        question: 'How do I place an order?',
        answer:
          'Choose your product, add any supplies you need, review your cart, complete checkout, and follow the payment instructions. If you have a qualifying receipt, upload it where prompted to receive the refill discount when available.',
      },
      {
        question: 'What supplies do I need?',
        answer:
          "Many customers purchase BAC water and insulin syringes when they do not already have supplies. PEPRXbot can help you find the supply kit, but you should follow your provider's instructions for preparation and use.",
      },
    ],
  },
  {
    category: 'Product Education',
    items: [
      {
        question: 'What is the difference between Trizep, Sema, and Reta?',
        answer:
          'Trizep, Sema, and Reta are commonly discussed in the weight-management peptide category. They may differ by formulation, vial size, customer familiarity, and price. PEPRXbot can help compare available product options and pricing, but it cannot recommend which product is medically appropriate for you.',
      },
      {
        question: 'Which one should I take?',
        answer:
          'PEPRXbot cannot recommend a specific peptide or treatment. Your licensed medical provider should determine what is appropriate for you. PEPRXbot can help you compare listed product sizes, pricing, supplies, and checkout options.',
      },
      {
        question: 'Can this help me lose weight?',
        answer:
          'Some products on PepScriptRX are commonly discussed in the weight-management category. Individual results vary, and PEPRXbot cannot make medical claims or guarantee outcomes. Speak with a licensed provider for medical guidance.',
      },
    ],
  },
  {
    category: 'Mixing Calculator',
    items: [
      {
        question: 'How do I use the Mixing Calculator?',
        answer:
          "Only after acknowledging the safety notice, copy the vial strength, diluent volume, and prescribed amount exactly from written provider or pharmacy instructions. The tool performs arithmetic only. It does not determine a dose or explain how to prepare or administer a product.",
      },
      {
        question: 'Can PEPRXbot tell me my dose?',
        answer:
          'No. PEPRXbot cannot prescribe or recommend a dose. The Mixing Calculator can perform arithmetic only after you enter values from written provider or pharmacy instructions.',
      },
      {
        question: 'If I add more BAC water, does it change the amount of product?',
        answer:
          'PEPRXbot cannot advise you to add or change diluent. Ask your pharmacist or licensed provider for preparation instructions. If they provide written values, the Mixing Calculator can calculate concentration and volume from those values.',
      },
    ],
  },
  {
    category: 'Receipt Upload / Discount',
    items: [
      {
        question: 'How does the receipt upload discount work?',
        answer:
          'If you have a qualifying prior receipt, upload it where prompted. PepScriptRX may apply a refill/customer discount when available. The system should guide you through the upload and checkout steps.',
      },
      {
        question: 'What if my receipt does not upload?',
        answer:
          'Try refreshing the page, checking file size and format, or using a clear screenshot or photo. If it still does not work, contact support.',
      },
    ],
  },
  {
    category: 'Checkout / Payment',
    items: [
      {
        question: 'How do I checkout?',
        answer:
          'Add products to cart, confirm the correct portal or storefront, enter your information, choose available payment instructions, and complete the order. Make sure your email and phone number are correct so you can receive confirmation and tracking.',
      },
      {
        question: 'Are Zelle and Venmo available?',
        answer:
          'If Zelle or Venmo is enabled for your checkout scope, it will appear during checkout with payment instructions. Follow the exact recipient and reference instructions shown on the payment page.',
      },
      {
        question: 'How do I know my order went through?',
        answer:
          'After completing checkout and payment, you should receive confirmation or instructions. Keep your order reference number. If you do not receive confirmation, contact support.',
      },
    ],
  },
  {
    category: 'Portal / Rep / Admin Navigation',
    items: [
      {
        question: 'What is a portal?',
        answer:
          'A portal is a branded storefront or tracking link connected to a representative, admin, or partner. It helps customers shop while giving the correct person credit for the sale.',
      },
      {
        question: 'Can PEPRXbot help reps?',
        answer:
          'Yes. PEPRXbot can help reps understand how to share their link, explain checkout basics, guide customers to upload receipts, and help with common customer questions. It cannot make medical claims or give medical advice.',
      },
    ],
  },
  {
    category: 'Shipping / Tracking / Support',
    items: [
      {
        question: 'Where can I see my current order status?',
        answer:
          'Sign in to the patient portal and open Dashboard for the complete order journey or Notifications for individual updates. Each notification links to the related order, payment screen, or shipping center.',
      },
      {
        question: 'When will my order ship?',
        answer:
          'Shipping times may vary depending on product availability, payment confirmation, and fulfillment. Check your confirmation message or contact support for order-specific tracking.',
      },
      {
        question: 'How do I contact support?',
        answer:
          'Open Help & Q&A and choose call, text, or email. Include your order reference, but never send passwords or payment credentials. Order-specific messages are best sent from the patient dashboard.',
      },
      {
        question: 'What should I do if there is a delivery exception?',
        answer:
          'Open the notification and check the carrier tracking page first. Confirm the shipping address shown in your portal, then contact support with the order reference if the carrier cannot resolve the exception.',
      },
      {
        question: 'How do refill reminders work?',
        answer:
          'The portal may show a reminder after a completed order approaches its expected refill window. Refills are never automatic; you must start a new request, and eligibility, availability, and review still apply.',
      },
      {
        question: 'I cannot access my account. What should I do?',
        answer:
          'Use the password-reset option on the login page and confirm you are using the same email as your intake. If that does not work, contact support without sharing your password.',
      },
    ],
  },
];
