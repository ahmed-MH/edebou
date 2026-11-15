import assert from "node:assert/strict";
import test from "node:test";

import { formatTunisianDinars } from "../src/lib/format-currency";
import {
  assertMoneyMillimes,
  MAX_MONEY_MILLIMES,
  parseTunisianDinarsToMillimes,
} from "../src/lib/money";

test("TND strings are converted to millimes without floating-point arithmetic", () => {
  assert.equal(parseTunisianDinarsToMillimes("49"), 49_000);
  assert.equal(parseTunisianDinarsToMillimes("12.345"), 12_345);
  assert.equal(parseTunisianDinarsToMillimes("12,3"), 12_300);
  assert.equal(parseTunisianDinarsToMillimes("0.001"), 1);
  assert.equal(
    parseTunisianDinarsToMillimes("9999999.999"),
    MAX_MONEY_MILLIMES,
  );
});

test("invalid, negative, fractional-millime, and excessive TND amounts are rejected", () => {
  for (const value of [
    "-1",
    ".5",
    "1.0001",
    "1e3",
    "01",
    "NaN",
    "10000000",
  ]) {
    assert.throws(() => parseTunisianDinarsToMillimes(value));
  }

  for (const value of [
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    MAX_MONEY_MILLIMES + 1,
  ]) {
    assert.throws(() => assertMoneyMillimes(value));
  }
});

test("millime amounts are formatted consistently for Arabic and French", () => {
  assert.equal(
    formatTunisianDinars(49_000, "fr"),
    new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(49),
  );
  assert.equal(
    formatTunisianDinars(49_000, "ar"),
    new Intl.NumberFormat("ar-TN", {
      style: "currency",
      currency: "TND",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(49),
  );
});
