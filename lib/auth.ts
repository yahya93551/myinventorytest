export function normalizePhoneNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }
  return `+${digits}`;
}

export function isPhoneNumber(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  return /^\+\d{7,15}$/.test(normalized);
}

export const countryOptions = [
  { code: "+252", country: "Somalia", flag: "🇸🇴" },
  { code: "+1", country: "United States", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
  { code: "+250", country: "Rwanda", flag: "🇷🇼" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
];

export function splitPhoneNumber(phone: string, defaultCode = "+252") {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return { countryCode: defaultCode, phone: "" };
  }

  const sortedOptions = [...countryOptions].sort((a, b) => b.code.length - a.code.length);
  const match = sortedOptions.find((option) => normalized.startsWith(option.code));
  if (!match) {
    return { countryCode: defaultCode, phone: normalized.slice(1) };
  }

  return {
    countryCode: match.code,
    phone: normalized.slice(match.code.length),
  };
}

export function createPhoneFallbackEmail(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  if (!isPhoneNumber(normalized)) {
    throw new Error("Invalid phone number");
  }

  return `${normalized.slice(1)}@phone.inventory.local`;
}

export function getAppUrl(path: string, fallbackOrigin = "https://myinventoryuse.com") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${normalizedPath}`;
  }

  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL;

  if (configuredOrigin) {
    return new URL(
      normalizedPath,
      configuredOrigin.endsWith("/") ? configuredOrigin : `${configuredOrigin}/`
    ).toString();
  }

  return `${fallbackOrigin}${normalizedPath}`;
}
