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
          'PEPRXbot can help you navigate PepScriptRX, compare general product categories, understand vial sizes, find supplies, use the mixing calculator, upload receipts, apply discounts, complete checkout, and locate support. PEPRXbot does not provide medical advice, dosing instructions, prescriptions, diagnosis, or treatment recommendations.',
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
        question: 'How do I use the mixing calculator?',
        answer:
          "Enter the vial strength in milligrams, the amount of BAC water added, and the dose amount you are trying to calculate based on your provider's instructions. The calculator helps convert concentration into an easier draw amount. It does not decide your dose.",
      },
      {
        question: 'Can PEPRXbot tell me my dose?',
        answer:
          'No. PEPRXbot cannot prescribe or recommend a dose. It can only help calculate measurements after you already have instructions from your licensed provider.',
      },
      {
        question: 'If I add more BAC water, does it change the amount of product?',
        answer:
          'No. Adding more BAC water changes the concentration and draw volume, but it does not change the total milligrams inside the vial.',
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
        question: 'Is Zelle available?',
        answer:
          'If Zelle is enabled for your checkout scope, it will appear during checkout with payment instructions. Follow the exact recipient and reference instructions shown on the payment page.',
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
        question: 'When will my order ship?',
        answer:
          'Shipping times may vary depending on product availability, payment confirmation, and fulfillment. Check your confirmation message or contact support for order-specific tracking.',
      },
      {
        question: 'How do I contact support?',
        answer:
          'Use the support contact listed on the website or checkout confirmation. PEPRXbot can direct customers to the correct support area.',
      },
    ],
  },
];
