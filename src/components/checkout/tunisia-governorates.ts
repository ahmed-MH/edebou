import type { AppLocale } from "@/i18n/routing";

export const governorateCodes = [
  "ariana",
  "beja",
  "ben-arous",
  "bizerte",
  "gabes",
  "gafsa",
  "jendouba",
  "kairouan",
  "kasserine",
  "kebili",
  "kef",
  "mahdia",
  "manouba",
  "medenine",
  "monastir",
  "nabeul",
  "sfax",
  "sidi-bouzid",
  "siliana",
  "sousse",
  "tataouine",
  "tozeur",
  "tunis",
  "zaghouan",
] as const;

export type GovernorateCode = (typeof governorateCodes)[number];

const labels: Record<GovernorateCode, Record<AppLocale, string>> = {
  ariana: { ar: "أريانة", fr: "Ariana" },
  beja: { ar: "باجة", fr: "Béja" },
  "ben-arous": { ar: "بن عروس", fr: "Ben Arous" },
  bizerte: { ar: "بنزرت", fr: "Bizerte" },
  gabes: { ar: "قابس", fr: "Gabès" },
  gafsa: { ar: "قفصة", fr: "Gafsa" },
  jendouba: { ar: "جندوبة", fr: "Jendouba" },
  kairouan: { ar: "القيروان", fr: "Kairouan" },
  kasserine: { ar: "القصرين", fr: "Kasserine" },
  kebili: { ar: "قبلي", fr: "Kébili" },
  kef: { ar: "الكاف", fr: "Le Kef" },
  mahdia: { ar: "المهدية", fr: "Mahdia" },
  manouba: { ar: "منوبة", fr: "La Manouba" },
  medenine: { ar: "مدنين", fr: "Médenine" },
  monastir: { ar: "المنستير", fr: "Monastir" },
  nabeul: { ar: "نابل", fr: "Nabeul" },
  sfax: { ar: "صفاقس", fr: "Sfax" },
  "sidi-bouzid": { ar: "سيدي بوزيد", fr: "Sidi Bouzid" },
  siliana: { ar: "سليانة", fr: "Siliana" },
  sousse: { ar: "سوسة", fr: "Sousse" },
  tataouine: { ar: "تطاوين", fr: "Tataouine" },
  tozeur: { ar: "توزر", fr: "Tozeur" },
  tunis: { ar: "تونس", fr: "Tunis" },
  zaghouan: { ar: "زغوان", fr: "Zaghouan" },
};

export function getGovernorates(locale: AppLocale) {
  return governorateCodes.map((code) => ({ code, label: labels[code][locale] }));
}
