// Explicit allowlist for public marketplace data: no owner contact, tax ID or documents.
export const merchantPublicSelect = {
  id: true, name: true, description: true, category: true, logoUrl: true, coverUrl: true,
  address: true, latitude: true, longitude: true, rating: true, deliveryEstimateMin: true,
  deliveryEstimateMax: true, isOpen: true, isActive: true, businessHours: true,
} as const;

export function publicMerchant<T extends { id: string; name: string }>(merchant: T) {
  return Object.fromEntries(Object.keys(merchantPublicSelect).filter(key => key in merchant).map(key => [key, merchant[key as keyof T]]));
}
