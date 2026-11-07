export interface CityOption {
  slug: string;
  name: string;
}
export const CITY_STORAGE_KEY = "atlas:last-city";
type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
export function browserStorage(): PreferenceStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
export function resolveCity(
  value: unknown,
  options: readonly CityOption[],
  storage = browserStorage(),
): string {
  const valid = (candidate: unknown): candidate is string =>
    typeof candidate === "string" &&
    options.some((option) => option.slug === candidate);
  if (valid(value)) return value;
  try {
    const saved = storage?.getItem(CITY_STORAGE_KEY);
    if (valid(saved)) return saved;
  } catch {
    /* Preference storage is optional. */
  }
  return "san-francisco";
}
export function rememberCity(city: string, storage = browserStorage()) {
  try {
    storage?.setItem(CITY_STORAGE_KEY, city);
  } catch {
    /* Browsing still works without storage. */
  }
}
