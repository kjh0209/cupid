// Placeholder for shared validation helpers
// TODO: replace with Zod schemas

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isNonEmpty(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function sanitizeString(value: string): string {
  return value.trim().replace(/<[^>]*>/g, "");
}
