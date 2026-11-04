/**
 * WhatsApp Flow JSON definitions for WAPPay.
 *
 * These are the official Flow JSON structures (version 7.3, data API 4.0)
 * ready to be uploaded to Meta's Flows API.
 *
 * WhatsApp green (#25D366) is WhatsApp's native primary button color —
 * Flow footer buttons render with WhatsApp's own styling automatically.
 */

// ─── Registration Flow ───────────────────────────────────────────────────────

export const REGISTRATION_FLOW_JSON: Record<string, any> = {
  version: '7.3',
  data_api_version: '4.0',
  routing_model: {
    PERSONAL_INFO: ['IDENTITY', 'PERSONAL_INFO'],
    IDENTITY: ['REVIEW', 'IDENTITY', 'PERSONAL_INFO'],
    REVIEW: ['SUCCESS', 'IDENTITY', 'PERSONAL_INFO'],
    SUCCESS: [],
  },
  screens: [
    {
      id: 'PERSONAL_INFO',
      title: 'Create Your Account',
      terminal: false,
      success: false,
      refresh_on_back: false,
      data: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        country: { type: 'string' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Create Your Account' },
          { type: 'TextBody', text: "Let's get to know you." },
          {
            type: 'Form',
            name: 'personal_form',
            children: [
              {
                type: 'TextInput',
                name: 'full_name',
                label: 'Full Name',
                'input-type': 'text',
                required: true,
                'min-chars': 2,
                'max-chars': 100,
                'helper-text': 'Enter your full legal name',
                'error-message': 'Please enter a valid full name',
              },
              {
                type: 'TextInput',
                name: 'email',
                label: 'Email (optional)',
                'input-type': 'email',
                required: false,
                'max-chars': 100,
                'helper-text': 'Leave blank if you do not have one',
              },
              {
                type: 'Dropdown',
                name: 'country',
                label: 'Country',
                required: true,
                'data-source': [
                  { id: 'NG', title: 'Nigeria' },
                  { id: 'GH', title: 'Ghana' },
                  { id: 'KE', title: 'Kenya' },
                  { id: 'ZA', title: 'South Africa' },
                  { id: 'UG', title: 'Uganda' },
                  { id: 'TZ', title: 'Tanzania' },
                  { id: 'RW', title: 'Rwanda' },
                  { id: 'ZM', title: 'Zambia' },
                  { id: 'ZW', title: 'Zimbabwe' },
                  { id: 'MW', title: 'Malawi' },
                ],
                'init-value': 'NG',
              },
            ],
          },
          {
            type: 'Footer',
            label: 'Continue',
            'on-click-action': {
              name: 'navigate',
              next: { type: 'screen', name: 'IDENTITY' },
              payload: {
                full_name: '${form.full_name}',
                email: '${form.email}',
                country: '${form.country}',
              },
            },
          },
        ],
      },
    },
    {
      id: 'IDENTITY',
      title: 'Verify Your Identity',
      terminal: false,
      success: false,
      refresh_on_back: true,
      data: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        country: { type: 'string' },
        identity_method: { type: 'string' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Verify Your Identity' },
          {
            type: 'TextBody',
            text: 'We need to verify your identity to enable the financial services available to you.',
          },
          {
            type: 'TextBody',
            text: 'Choose a verification method below. Your information is encrypted and handled securely.',
          },
          {
            type: 'Form',
            name: 'identity_form',
            children: [
              {
                type: 'RadioButtonsGroup',
                name: 'identity_method',
                label: 'Verification Method',
                required: true,
                'data-source': [
                  {
                    id: 'NIN',
                    title: 'NIN Verification',
                    description: 'Verify with your National Identification Number',
                  },
                  {
                    id: 'BVN',
                    title: 'BVN Verification',
                    description: 'Verify with your Bank Verification Number',
                  },
                ],
              },
              {
                type: 'TextInput',
                name: 'identity_number',
                label: 'NIN / BVN Number',
                'input-type': 'text',
                required: true,
                pattern: '^\\d{11}$',
                'min-chars': 11,
                'max-chars': 11,
                'helper-text': 'Enter your 11-digit number',
                'error-message': 'Must be exactly 11 digits',
              },
            ],
          },
          {
            type: 'Footer',
            label: 'Continue',
            'on-click-action': {
              name: 'data_exchange',
              payload: {
                full_name: '${screen.PERSONAL_INFO.form.full_name}',
                email: '${screen.PERSONAL_INFO.form.email}',
                country: '${screen.PERSONAL_INFO.form.country}',
                identity_method: '${form.identity_method}',
                identity_number: '${form.identity_number}',
              },
            },
          },
        ],
      },
    },
    {
      id: 'REVIEW',
      title: 'Review Your Details',
      terminal: false,
      success: false,
      refresh_on_back: true,
      data: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        country: { type: 'string' },
        identity_method: { type: 'string' },
        identity_status: { type: 'string' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Review Your Details' },
          { type: 'TextSubheading', text: 'Please confirm everything is correct.' },
          { type: 'TextBody', text: 'Name: ${data.full_name}' },
          { type: 'TextBody', text: 'Email: ${data.email}' },
          { type: 'TextBody', text: 'Country: ${data.country}' },
          { type: 'TextBody', text: 'Identity (${data.identity_method}): ${data.identity_status}' },
          { type: 'TextCaption', text: 'By confirming, you agree to WappPay Terms of Service and Privacy Policy.' },
          {
            type: 'Footer',
            label: 'Confirm Registration',
            'on-click-action': {
              name: 'data_exchange',
              payload: {
                full_name: '${data.full_name}',
                email: '${data.email}',
                country: '${data.country}',
                identity_method: '${data.identity_method}',
                identity_number: '${data.identity_number}',
              },
            },
          },
        ],
      },
    },
    {
      id: 'SUCCESS',
      title: 'Account Created Successfully!',
      terminal: true,
      success: true,
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Account Created Successfully!' },
          {
            type: 'TextBody',
            text: 'Congratulations! Your WappPay account has been created.\n\nWe are preparing your wallet.',
          },
          {
            type: 'Footer',
            label: 'Done',
            'on-click-action': {
              name: 'complete',
              payload: { status: 'registered' },
            },
          },
        ],
      },
    },
  ],
};

// ─── Deposit Flow ────────────────────────────────────────────────────────────

export const DEPOSIT_FLOW_JSON: Record<string, any> = {
  version: '7.3',
  data_api_version: '4.0',
  routing_model: {
    ENTER_AMOUNT: ['METHOD', 'ENTER_AMOUNT'],
    METHOD: ['REVIEW', 'METHOD', 'ENTER_AMOUNT'],
    REVIEW: ['SUCCESS', 'METHOD', 'ENTER_AMOUNT'],
    SUCCESS: [],
  },
  screens: [
    {
      id: 'ENTER_AMOUNT',
      title: 'Deposit Money',
      terminal: false,
      success: false,
      refresh_on_back: false,
      data: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        current_balance: { type: 'number' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Deposit Money' },
          {
            type: 'TextBody',
            text: 'How much would you like to add to your WappPay test wallet?',
          },
          { type: 'TextCaption', text: 'Current balance: ${data.current_balance}' },
          {
            type: 'Form',
            name: 'amount_form',
            children: [
              {
                type: 'TextInput',
                name: 'amount',
                label: 'Amount (NGN)',
                'input-type': 'number',
                required: true,
                'helper-text': 'Enter amount in Naira',
                'error-message': 'Enter a valid positive amount',
              },
            ],
          },
          {
            type: 'Footer',
            label: 'Continue',
            'on-click-action': {
              name: 'data_exchange',
              payload: {
                amount: '${form.amount}',
                currency: 'NGN',
                current_balance: '${data.current_balance}',
              },
            },
          },
        ],
      },
    },
    {
      id: 'METHOD',
      title: 'Choose Deposit Method',
      terminal: false,
      success: false,
      refresh_on_back: true,
      data: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        current_balance: { type: 'number' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Choose Deposit Method' },
          {
            type: 'Form',
            name: 'method_form',
            children: [
              {
                type: 'RadioButtonsGroup',
                name: 'method',
                label: 'Select method',
                required: true,
                'data-source': [
                  {
                    id: 'SIMULATE',
                    title: 'Simulate Deposit',
                    description: 'Instantly add test funds to your wallet',
                  },
                  {
                    id: 'BANK_TRANSFER',
                    title: 'Bank Transfer',
                    description: 'Coming soon',
                  },
                ],
                'init-value': 'SIMULATE',
              },
            ],
          },
          {
            type: 'Footer',
            label: 'Continue',
            'on-click-action': {
              name: 'navigate',
              next: { type: 'screen', name: 'REVIEW' },
              payload: {
                amount: '${data.amount}',
                currency: '${data.currency}',
                current_balance: '${data.current_balance}',
                method: '${form.method}',
              },
            },
          },
        ],
      },
    },
    {
      id: 'REVIEW',
      title: 'Review Deposit',
      terminal: false,
      success: false,
      refresh_on_back: true,
      data: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        current_balance: { type: 'number' },
        method: { type: 'string' },
        new_balance: { type: 'number' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Review Deposit' },
          { type: 'TextBody', text: 'Deposit Amount: ${data.amount}' },
          { type: 'TextBody', text: 'Currency: ${data.currency}' },
          { type: 'TextBody', text: 'Deposit Method: Simulated Deposit' },
          { type: 'TextBody', text: 'Current Balance: ${data.current_balance}' },
          { type: 'TextBody', text: 'New Balance: ${data.new_balance}' },
          { type: 'TextCaption', text: 'Transaction Type: TEST DEPOSIT' },
          {
            type: 'Footer',
            label: 'Confirm Deposit',
            'on-click-action': {
              name: 'data_exchange',
              payload: {
                amount: '${data.amount}',
                currency: '${data.currency}',
                method: '${data.method}',
                current_balance: '${data.current_balance}',
              },
            },
          },
        ],
      },
    },
    {
      id: 'SUCCESS',
      title: 'Deposit Successful!',
      terminal: true,
      success: true,
      data: {
        amount: { type: 'number' },
        new_balance: { type: 'number' },
        reference: { type: 'string' },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Deposit Successful!' },
          { type: 'TextBody', text: 'Amount: ${data.amount}' },
          { type: 'TextBody', text: 'New Balance: ${data.new_balance}' },
          { type: 'TextBody', text: 'Reference: ${data.reference}' },
          { type: 'TextCaption', text: 'This was a simulated test deposit.' },
          {
            type: 'Footer',
            label: 'Done',
            'on-click-action': {
              name: 'complete',
              payload: { status: 'deposited' },
            },
          },
        ],
      },
    },
  ],
};

// ─── Flow IDs (configured via env) ──────────────────────────────────────────

export function getRegistrationFlowId(): string {
  return process.env.WHATSAPP_REGISTRATION_FLOW_ID || '';
}

export function getDepositFlowId(): string {
  return process.env.WHATSAPP_DEPOSIT_FLOW_ID || '';
}
