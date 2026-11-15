import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

import { routing, type AppLocale } from "./routing";

type Messages = typeof import("../../messages/ar.json");

const messageLoaders: Record<AppLocale, () => Promise<Messages>> = {
  ar: () => import("../../messages/ar.json").then((module) => module.default),
  fr: () => import("../../messages/fr.json").then((module) => module.default),
};

export default getRequestConfig(async () => {
  const requestedLocale = (await headers()).get("x-edebou-locale");
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: await messageLoaders[locale](),
    timeZone: "Africa/Tunis",
  };
});
