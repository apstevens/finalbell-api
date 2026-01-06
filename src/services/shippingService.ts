/**
 * Shipping Service
 * Calculates shipping costs based on cart weight and destination
 *
 * All parcels are sent by express courier to ensure the highest level of service
 * and tracking information for peace of mind and a reduction in lost parcels.
 *
 * Couriers:
 * - DHL for all parcels under 30kg
 * - DX Freight for all filled punchbag deliveries (over 30kg)
 *
 * Dispatch:
 * - Monday-Friday operations
 * - Same day or next working day dispatch where possible
 * - Maximum 2 day dispatch time during busy periods
 *
 * Delivery Times:
 * - Mainland UK: Next day delivery (2-3 days for northern Scotland and UK-offshore)
 */

import { CheckoutItem } from './stripeService';
import { productService } from './productService';

export interface ShippingRate {
  name: string;
  amount: number; // in pence
  minDays: number;
  maxDays: number;
  courier?: string;
  restrictions?: string[];
}

export type ShippingRegion = 'MAINLAND_UK' | 'NORTHERN_IRELAND' | 'UK_OFFSHORE' | 'EU';

/**
 * Default weight for products not found in CSV (in grams)
 */
const DEFAULT_PRODUCT_WEIGHT = 500;

/**
 * Weight threshold for filled punchbags (in grams)
 */
const FILLED_PUNCHBAG_WEIGHT = 30000; // 30kg

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
 * Calculate shipping cost for Mainland UK
 * Standard: £5 per 10kg
 * Wholesale (over 100kg): £5 per 10kg up to 100kg, then £10 per 20kg
 */
function calculateMainlandUKShipping(weightGrams: number): number {
  const weightKg = weightGrams / 1000;

  if (weightKg <= 100) {
    // Standard pricing: £5 per 10kg
    const units = Math.ceil(weightKg / 10);
    return units * 500; // £5.00 in pence
  } else {
    // Wholesale pricing: £5 per 10kg up to 100kg, then £10 per 20kg
    const baseCharge = 10 * 500; // First 100kg: 10 units of £5
    const remainingKg = weightKg - 100;
    const additionalUnits = Math.ceil(remainingKg / 20);
    const additionalCharge = additionalUnits * 1000; // £10.00 per 20kg
    return baseCharge + additionalCharge;
  }
}

/**
 * Calculate shipping cost for Northern Ireland
 * £10 up to 5kg
 * £15 for 5-20kg
 * £30 for 20-40kg
 * Multiple parcels: £15 per box (max 20kg per box)
 */
function calculateNorthernIrelandShipping(weightGrams: number): { amount: number; restrictions: string[] } {
  const weightKg = weightGrams / 1000;
  const restrictions: string[] = [];

  // Cannot deliver filled punchbags
  if (weightKg > 30) {
    restrictions.push('Cannot deliver filled punchbags to Northern Ireland');
    // Calculate as multiple parcels
    const numBoxes = Math.ceil(weightKg / 20);
    return { amount: numBoxes * 1500, restrictions }; // £15 per box
  }

  if (weightKg <= 5) {
    return { amount: 1000, restrictions }; // £10.00
  } else if (weightKg <= 20) {
    return { amount: 1500, restrictions }; // £15.00
  } else if (weightKg <= 40) {
    return { amount: 3000, restrictions }; // £30.00
  } else {
    // Multiple parcels
    const numBoxes = Math.ceil(weightKg / 20);
    return { amount: numBoxes * 1500, restrictions }; // £15 per box
  }
}

/**
 * Calculate shipping cost for UK Offshore Islands (Jersey, Guernsey, Isle of Man)
 * £15 up to 5kg
 * £20 for 5-20kg
 * £25 for 20-40kg
 * Multiple parcels: £20 per box (max 20kg per box)
 * Note: Orders not charged VAT, customs fees are customer's responsibility
 */
function calculateUKOffshoreShipping(weightGrams: number): { amount: number; restrictions: string[] } {
  const weightKg = weightGrams / 1000;
  const restrictions: string[] = ['VAT not charged - customs fees are your responsibility'];

  // Cannot deliver filled punchbags
  if (weightKg > 30) {
    restrictions.push('Cannot deliver filled punchbags to UK Offshore addresses');
    // Calculate as multiple parcels
    const numBoxes = Math.ceil(weightKg / 20);
    return { amount: numBoxes * 2000, restrictions }; // £20 per box
  }

  if (weightKg <= 5) {
    return { amount: 1500, restrictions }; // £15.00
  } else if (weightKg <= 20) {
    return { amount: 2000, restrictions }; // £20.00
  } else if (weightKg <= 40) {
    return { amount: 2500, restrictions }; // £25.00
  } else {
    // Multiple parcels
    const numBoxes = Math.ceil(weightKg / 20);
    return { amount: numBoxes * 2000, restrictions }; // £20 per box
  }
}

/**
 * Determine shipping region from postcode or country
 */
export function determineShippingRegion(postcode?: string, country?: string): ShippingRegion {
  if (!country || country.toUpperCase() === 'GB' || country.toUpperCase() === 'UK') {
    // Check for Northern Ireland postcodes
    if (postcode && /^BT\d/i.test(postcode)) {
      return 'NORTHERN_IRELAND';
    }
    // Check for offshore islands
    if (postcode && (/^(JE|GY|IM)\d/i.test(postcode) || /^HS\d/i.test(postcode))) {
      return 'UK_OFFSHORE';
    }
    return 'MAINLAND_UK';
  }

  // EU countries - currently not available
  const euCountries = ['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'IE', 'PT', 'AT', 'SE', 'DK', 'FI', 'PL', 'CZ', 'RO', 'GR'];
  if (euCountries.includes(country.toUpperCase())) {
    return 'EU';
  }

  // Default to mainland UK for other GB addresses
  return 'MAINLAND_UK';
}

/**
 * Get shipping rates based on cart items and destination
 */
export async function getShippingRates(
  items: CheckoutItem[],
  region: ShippingRegion = 'MAINLAND_UK'
): Promise<ShippingRate[]> {
  const totalWeight = await calculateTotalWeight(items);
  const weightKg = totalWeight / 1000;

  console.log(`[Shipping] Total cart weight: ${totalWeight}g (${weightKg}kg)`);
  console.log(`[Shipping] Shipping region: ${region}`);

  // EU check
  if (region === 'EU') {
    throw new Error('We are currently not delivering to the EU but will be reactivating this service to certain countries later this year. Please contact us for further information.');
  }

  // Determine courier based on weight
  const courier = totalWeight < FILLED_PUNCHBAG_WEIGHT ? 'DHL' : 'DX Freight';
  const isFilled = totalWeight >= FILLED_PUNCHBAG_WEIGHT;

  let amount: number;
  let restrictions: string[] = [];
  let minDays = 1;
  let maxDays = 1;
  let displayName = 'Express Courier Delivery';

  switch (region) {
    case 'MAINLAND_UK': {
      amount = calculateMainlandUKShipping(totalWeight);
      // Check for northern Scotland or remote areas
      displayName = 'Next Day Delivery (2-3 days for northern Scotland)';
      maxDays = 3;
      break;
    }
    case 'NORTHERN_IRELAND': {
      if (isFilled) {
        throw new Error('Cannot deliver filled punchbags to Northern Ireland');
      }
      const result = calculateNorthernIrelandShipping(totalWeight);
      amount = result.amount;
      restrictions = result.restrictions;
      minDays = 1;
      maxDays = 2;
      displayName = 'Express Courier Delivery (1-2 days)';
      break;
    }
    case 'UK_OFFSHORE': {
      if (isFilled) {
        throw new Error('Cannot deliver filled punchbags to UK Offshore addresses');
      }
      const result = calculateUKOffshoreShipping(totalWeight);
      amount = result.amount;
      restrictions = result.restrictions;
      minDays = 2;
      maxDays = 3;
      displayName = 'Express Courier Delivery (2-3 days)';
      break;
    }
    default:
      throw new Error(`Unsupported shipping region: ${region}`);
  }

  console.log(`[Shipping] Courier: ${courier}`);
  console.log(`[Shipping] Cost: £${(amount / 100).toFixed(2)}`);
  if (restrictions.length > 0) {
    console.log(`[Shipping] Restrictions: ${restrictions.join(', ')}`);
  }

  return [
    {
      name: displayName,
      amount,
      minDays,
      maxDays,
      courier,
      restrictions: restrictions.length > 0 ? restrictions : undefined,
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
