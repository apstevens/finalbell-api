/**
 * Shipping Service
 * Calculates shipping costs based on cart weight and provides shipping options
 */

import { CheckoutItem } from './stripeService';
import { productService } from './productService';

export interface ShippingRate {
  name: string;
  amount: number; // in pence
  minDays: number;
  maxDays: number;
}

/**
 * UK Shipping Rate Tiers
 * Adjust these rates according to your business needs
 */
const SHIPPING_TIERS = [
  { maxWeight: 500, standard: 395, express: 695 },     // Up to 500g: £3.95 / £6.95
  { maxWeight: 1000, standard: 495, express: 895 },    // Up to 1kg: £4.95 / £8.95
  { maxWeight: 2000, standard: 695, express: 1195 },   // Up to 2kg: £6.95 / £11.95
  { maxWeight: 5000, standard: 995, express: 1695 },   // Up to 5kg: £9.95 / £16.95
  { maxWeight: 10000, standard: 1495, express: 2495 }, // Up to 10kg: £14.95 / £24.95
  { maxWeight: Infinity, standard: 1995, express: 2995 }, // Over 10kg: £19.95 / £29.95
];

/**
 * Default weight for products not found in CSV (in grams)
 */
const DEFAULT_PRODUCT_WEIGHT = 500;

/**
 * Free shipping threshold (in pence)
 */
const FREE_SHIPPING_THRESHOLD = 10000; // £100

/**
 * Calculate total weight of items in cart
 */
async function calculateTotalWeight(items: CheckoutItem[]): Promise<number> {
  let totalWeight = 0;

  try {
    const products = await productService.getAllProducts();

    for (const item of items) {
      // Try to find product by matching name
      const product = products.find(p =>
        p.title.toLowerCase().includes(item.name.toLowerCase()) ||
        item.name.toLowerCase().includes(p.title.toLowerCase())
      );

      if (product && product.variants.length > 0) {
        // Use first variant's weight (or match by SKU if available)
        const weight = product.variants[0].weightGrams || DEFAULT_PRODUCT_WEIGHT;
        totalWeight += weight * item.quantity;
        console.log(`[Shipping] ${item.name}: ${weight}g x ${item.quantity} = ${weight * item.quantity}g`);
      } else {
        // Default weight if product not found
        console.warn(`[Shipping] Product weight not found for: ${item.name}, using default ${DEFAULT_PRODUCT_WEIGHT}g`);
        totalWeight += DEFAULT_PRODUCT_WEIGHT * item.quantity;
      }
    }
  } catch (error) {
    console.error('[Shipping] Error loading products for weight calculation:', error);
    // Fallback: use default weight for all items
    totalWeight = items.reduce((sum, item) => sum + (DEFAULT_PRODUCT_WEIGHT * item.quantity), 0);
  }

  return totalWeight;
}

/**
 * Calculate total cart value (in pence)
 */
function calculateCartTotal(items: CheckoutItem[]): number {
  return items.reduce((sum, item) => sum + (Math.round(item.price * 100) * item.quantity), 0);
}

/**
 * Get shipping rates based on cart items
 */
export async function getShippingRates(items: CheckoutItem[]): Promise<ShippingRate[]> {
  const totalWeight = await calculateTotalWeight(items);
  const cartTotal = calculateCartTotal(items);

  console.log(`[Shipping] Total cart weight: ${totalWeight}g`);
  console.log(`[Shipping] Total cart value: £${(cartTotal / 100).toFixed(2)}`);

  // Check for free shipping
  if (cartTotal >= FREE_SHIPPING_THRESHOLD) {
    console.log(`[Shipping] Free shipping applied (cart over £${FREE_SHIPPING_THRESHOLD / 100})`);
    return [
      {
        name: 'Free Standard Shipping (3-5 business days)',
        amount: 0,
        minDays: 3,
        maxDays: 5,
      },
      {
        name: 'Express Shipping (1-2 business days)',
        amount: 495, // Still charge for express even with free standard shipping
        minDays: 1,
        maxDays: 2,
      },
    ];
  }

  // Find applicable tier
  const tier = SHIPPING_TIERS.find(t => totalWeight <= t.maxWeight);

  if (!tier) {
    throw new Error(`Weight exceeds maximum shipping limit (${totalWeight}g)`);
  }

  console.log(`[Shipping] Using tier for ${tier.maxWeight}g: Standard £${tier.standard / 100}, Express £${tier.express / 100}`);

  return [
    {
      name: 'Standard Shipping (3-5 business days)',
      amount: tier.standard,
      minDays: 3,
      maxDays: 5,
    },
    {
      name: 'Express Shipping (1-2 business days)',
      amount: tier.express,
      minDays: 1,
      maxDays: 2,
    },
  ];
}

/**
 * Format shipping rates for Stripe Checkout
 */
export function formatShippingRatesForStripe(rates: ShippingRate[]) {
  return rates.map(rate => ({
    shipping_rate_data: {
      type: 'fixed_amount' as const,
      fixed_amount: {
        amount: rate.amount,
        currency: 'gbp',
      },
      display_name: rate.name,
      delivery_estimate: {
        minimum: {
          unit: 'business_day' as const,
          value: rate.minDays,
        },
        maximum: {
          unit: 'business_day' as const,
          value: rate.maxDays,
        },
      },
    },
  }));
}
