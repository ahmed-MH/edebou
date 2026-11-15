import type { AppLocale } from "@/i18n/routing";

import { assertMoneyMillimes, MILLIMES_PER_TND } from "@/lib/money";

const formatters: Record<AppLocale, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat("ar-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
  fr: new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }),
};

export function formatTunisianDinars(
  priceMillimes: number,
  locale: AppLocale,
): string {
  return formatters[locale].format(
    assertMoneyMillimes(priceMillimes, "Price") / MILLIMES_PER_TND,
  );
}

export {
  assertMoneyMillimes,
  MAX_MONEY_MILLIMES,
  MILLIMES_PER_TND,
  parseTunisianDinarsToMillimes,
} from "@/lib/money";
