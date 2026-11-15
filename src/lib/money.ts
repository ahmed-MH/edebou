export const MILLIMES_PER_TND = 1_000;

/**
 * Upper bound shared by validation and persistence constraints.
 * This represents 9,999,999.999 TND and remains far below Number.MAX_SAFE_INTEGER.
 */
export const MAX_MONEY_MILLIMES = 9_999_999_999;

export function assertMoneyMillimes(
  value: number,
  fieldName = "Amount",
): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be an integer number of millimes.`);
  }

  if (value < 0 || value > MAX_MONEY_MILLIMES) {
    throw new RangeError(
      `${fieldName} must be between 0 and ${MAX_MONEY_MILLIMES} millimes.`,
    );
  }

  return value;
}

/**
 * Converts a user-facing decimal TND string without ever passing through a
 * floating-point representation. Both Tunisian comma and dot separators are
 * accepted, with at most three millime digits.
 */
export function parseTunisianDinarsToMillimes(value: string): number {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:[.,](\d{1,3}))?$/.exec(normalized);

  if (!match) {
    throw new TypeError(
      "A TND amount must be a non-negative decimal with at most three fractional digits.",
    );
  }

  const dinars = Number(match[1]);
  const fractionalMillimes = Number((match[2] ?? "").padEnd(3, "0"));

  if (!Number.isSafeInteger(dinars)) {
    throw new RangeError("The TND amount exceeds the supported range.");
  }

  return assertMoneyMillimes(
    dinars * MILLIMES_PER_TND + fractionalMillimes,
    "TND amount",
  );
}
