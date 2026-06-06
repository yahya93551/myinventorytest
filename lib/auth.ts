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

export function createPhoneFallbackEmail(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  if (!isPhoneNumber(normalized)) {
    throw new Error("Invalid phone number");
  }

  return `${normalized.slice(1)}@phone.inventory.local`;
}
