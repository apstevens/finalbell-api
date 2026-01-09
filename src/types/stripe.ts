/**
 * Shared Stripe-related types
 * Used across multiple services to avoid circular dependencies
 */

export interface CheckoutItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}
