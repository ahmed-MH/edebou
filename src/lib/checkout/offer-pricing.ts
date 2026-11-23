export type StoredPriceTier = {
  readonly minQuantity: number;
  readonly unitPrice: bigint;
  readonly bundleTotal: bigint | null;
};

export function priceOrderLine(
  basePrice: bigint,
  quantity: number,
  tiers: readonly StoredPriceTier[],
): { readonly unitPrice: bigint; readonly lineTotal: bigint } {
  const exactOffer = tiers.find(
    (tier) => tier.minQuantity === quantity && tier.bundleTotal !== null,
  );
  if (exactOffer?.bundleTotal !== null && exactOffer?.bundleTotal !== undefined) {
    return {
      unitPrice: exactOffer.bundleTotal / BigInt(quantity),
      lineTotal: exactOffer.bundleTotal,
    };
  }

  const applicableTier = tiers
    .filter((tier) => tier.bundleTotal === null && tier.minQuantity <= quantity)
    .reduce<StoredPriceTier | null>(
      (best, tier) => !best || tier.minQuantity > best.minQuantity ? tier : best,
      null,
    );
  const unitPrice = applicableTier?.unitPrice ?? basePrice;
  return { unitPrice, lineTotal: unitPrice * BigInt(quantity) };
}
