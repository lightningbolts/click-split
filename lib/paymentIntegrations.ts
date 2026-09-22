/**
 * Click Split - Multi-Provider Payment Rails Dispatcher
 *
 * Supports Venmo, PayPal, Cash App, Zelle, Apple Pay / Google Pay, and Cash.
 */

export type PaymentMethod =
  | 'venmo'
  | 'paypal'
  | 'cashapp'
  | 'zelle'
  | 'applepay'
  | 'googlepay'
  | 'cash';

export interface PaymentRailConfig {
  method: PaymentMethod;
  name: string;
  icon: string;
  badgeColor: string;
  handleLabel: string;
  handlePlaceholder: string;
  supportsDeepLink: boolean;
}

export const PAYMENT_RAILS: Record<PaymentMethod, PaymentRailConfig> = {
  venmo: {
    method: 'venmo',
    name: 'Venmo',
    icon: 'V',
    badgeColor: '#008CFF',
    handleLabel: 'Venmo username',
    handlePlaceholder: 'e.g. username (without @)',
    supportsDeepLink: true,
  },
  paypal: {
    method: 'paypal',
    name: 'PayPal',
    icon: 'P',
    badgeColor: '#003087',
    handleLabel: 'PayPal.Me username',
    handlePlaceholder: 'e.g. johnsmith',
    supportsDeepLink: true,
  },
  cashapp: {
    method: 'cashapp',
    name: 'Cash App',
    icon: '$',
    badgeColor: '#00D632',
    handleLabel: 'Cashtag',
    handlePlaceholder: 'e.g. Cashtag (without $)',
    supportsDeepLink: true,
  },
  zelle: {
    method: 'zelle',
    name: 'Zelle',
    icon: 'Z',
    badgeColor: '#7414CA',
    handleLabel: 'Zelle email or phone',
    handlePlaceholder: 'e.g. friend@example.com or 555-123-4567',
    supportsDeepLink: false,
  },
  applepay: {
    method: 'applepay',
    name: 'Apple Pay',
    icon: 'A',
    badgeColor: '#000000',
    handleLabel: 'Apple Cash / iMessage',
    handlePlaceholder: 'Phone or Apple ID',
    supportsDeepLink: true,
  },
  googlepay: {
    method: 'googlepay',
    name: 'Google Pay',
    icon: 'G',
    badgeColor: '#4285F4',
    handleLabel: 'Google Pay email/phone',
    handlePlaceholder: 'Email or phone',
    supportsDeepLink: true,
  },
  cash: {
    method: 'cash',
    name: 'Cash / Other',
    icon: '✓',
    badgeColor: 'var(--ink)',
    handleLabel: '',
    handlePlaceholder: '',
    supportsDeepLink: false,
  },
};

/**
 * Dispatches a payment via deep link, web fallback, or W3C payment sheet.
 */
export async function launchPaymentRail({
  method,
  recipientHandle,
  amount,
  groupName,
  recipientName,
}: {
  method: PaymentMethod;
  recipientHandle?: string;
  amount: number;
  groupName: string;
  recipientName: string;
}): Promise<{ launched: boolean; instructions?: string }> {
  const note = `Click Split: ${groupName}`;
  const amtFormatted = amount.toFixed(2);
  const cleanHandle = recipientHandle?.trim().replace(/^[@$]/, '') ?? '';

  switch (method) {
    case 'venmo': {
      if (cleanHandle) {
        // Native app deep link with web fallback
        const deepLink = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(cleanHandle)}&amount=${amtFormatted}&note=${encodeURIComponent(note)}`;
        const webFallback = `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(cleanHandle)}&amount=${amtFormatted}&note=${encodeURIComponent(note)}`;

        window.location.href = deepLink;
        setTimeout(() => {
          window.open(webFallback, '_blank');
        }, 800);
      } else {
        window.open(`https://venmo.com/?txn=pay&amount=${amtFormatted}&note=${encodeURIComponent(note)}`, '_blank');
      }
      return { launched: true };
    }

    case 'paypal': {
      if (cleanHandle) {
        window.open(`https://paypal.me/${encodeURIComponent(cleanHandle)}/${amtFormatted}`, '_blank');
      } else {
        window.open(`https://www.paypal.com/myaccount/transfer/homepage`, '_blank');
      }
      return { launched: true };
    }

    case 'cashapp': {
      if (cleanHandle) {
        window.open(`https://cash.app/$${encodeURIComponent(cleanHandle)}/${amtFormatted}`, '_blank');
      } else {
        window.open('https://cash.app', '_blank');
      }
      return { launched: true };
    }

    case 'zelle': {
      window.open('https://www.zellepay.com/send-money', '_blank');
      return {
        launched: true,
        instructions: cleanHandle
          ? `Send $${amtFormatted} to ${recipientName} via Zelle using ${cleanHandle}`
          : `Send $${amtFormatted} to ${recipientName} through your bank app using Zelle`,
      };
    }

    case 'applepay': {
      // Check if PaymentRequest is supported (iOS Safari)
      if (typeof window !== 'undefined' && 'PaymentRequest' in window) {
        try {
          const request = new PaymentRequest(
            [
              {
                supportedMethods: 'https://apple.com/apple-pay',
                data: {
                  version: 3,
                  merchantIdentifier: 'merchant.co.joinclick',
                  countryCode: 'US',
                  currencyCode: 'USD',
                },
              },
            ],
            {
              total: {
                label: `Click Split to ${recipientName}`,
                amount: { currency: 'USD', value: amtFormatted },
              },
            },
          );
          // If can make payment, show sheet
          const canPay = await request.canMakePayment();
          if (canPay) {
            await request.show();
            return { launched: true };
          }
        } catch {
          // Fall through to SMS / deep link
        }
      }

      // Fallback: prompt or iMessage Apple Cash
      if (cleanHandle) {
        window.open(`sms:${encodeURIComponent(cleanHandle)}&body=${encodeURIComponent(`Paying you $${amtFormatted} for ${groupName} via Click Split`)}`, '_blank');
      } else {
        window.open('https://www.apple.com/apple-cash/', '_blank');
      }
      return { launched: true };
    }

    case 'googlepay': {
      window.open(`https://pay.google.com/gp/v/send/${cleanHandle ? `?recipient=${encodeURIComponent(cleanHandle)}` : ''}`, '_blank');
      return { launched: true };
    }

    case 'cash':
    default:
      return { launched: false };
  }
}
