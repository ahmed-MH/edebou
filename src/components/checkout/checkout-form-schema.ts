import { z } from "zod";

import { governorateCodes } from "./tunisia-governorates";

export const checkoutPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .refine((value) => /^(?:(?:\+|00)?216)?[234579]\d{7}$/.test(value))
  .transform((value) => {
    const nationalNumber = value.replace(/^(?:\+216|00216|216)/, "");
    return `+216${nationalNumber}`;
  });

export const checkoutFormSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: checkoutPhoneSchema,
    governorate: z.enum(governorateCodes),
    address: z.string().trim().min(8).max(300),
    notes: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutCustomer = z.output<typeof checkoutFormSchema>;
