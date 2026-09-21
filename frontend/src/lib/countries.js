// Small curated list of countries the mock material catalog knows about,
// plus a locale-based country auto-detect. Detection is entirely
// client-side (no network call, no permission prompt) — it just reads the
// browser's own locale, matching the app's local-first, server-light
// principle. It's a default, not a lock: the user can always override it.
export const COUNTRIES = [
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "IN", name: "India", currency: "INR" },
];

const DEFAULT_COUNTRY = "US";

export function detectCountry() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof Intl.Locale === "function") {
      const region = new Intl.Locale(locale).maximize().region;
      if (region) return region;
    }
    const match = /-([A-Z]{2})$/.exec(locale || "");
    if (match) return match[1];
  } catch {
    // Intl.Locale unsupported, or the locale couldn't be parsed — fall
    // through to the default rather than guessing.
  }
  return DEFAULT_COUNTRY;
}

// Same as detectCountry(), but clamped to the countries this app's <Select>
// menus actually list, so the UI never shows a selector with no matching
// option. The project's `country` field itself is NOT restricted to this
// list elsewhere (the backend has its own generic fallback for any country).
export function detectSupportedCountry() {
  const detected = detectCountry();
  return COUNTRIES.some((c) => c.code === detected) ? detected : DEFAULT_COUNTRY;
}

export function countryLabel(code) {
  return COUNTRIES.find((c) => c.code === code)?.name || code || "—";
}

export function currencyForCountry(code) {
  return COUNTRIES.find((c) => c.code === code)?.currency || "USD";
}
