import { describe, expect, it } from "vitest";
import { CITY_STORAGE_KEY, rememberCity, resolveCity } from "./city";
const options = [
  { slug: "san-francisco", name: "San Francisco" },
  { slug: "tokyo", name: "Tokyo" },
  { slug: "general", name: "General" },
];
describe("city preferences", () => {
  it("prioritizes valid URLs without overwriting saved preferences", () => {
    localStorage.setItem(CITY_STORAGE_KEY, "tokyo");
    expect(resolveCity("general", options)).toBe("general");
    expect(localStorage.getItem(CITY_STORAGE_KEY)).toBe("tokyo");
  });
  it("uses valid saved choices for absent or invalid URLs", () => {
    localStorage.setItem(CITY_STORAGE_KEY, "general");
    expect(resolveCity(undefined, options)).toBe("general");
    expect(resolveCity("unknown", options)).toBe("general");
  });
  it("falls back when both sources are invalid", () => {
    localStorage.setItem(CITY_STORAGE_KEY, "removed-city");
    expect(resolveCity(["tokyo"], options)).toBe("san-francisco");
  });
  it("keeps browsing usable when storage throws", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(resolveCity(undefined, options, storage)).toBe("san-francisco");
    expect(resolveCity("tokyo", options, storage)).toBe("tokyo");
    expect(() => rememberCity("tokyo", storage)).not.toThrow();
  });
  it("persists explicit selections, including General", () => {
    rememberCity("general");
    expect(localStorage.getItem(CITY_STORAGE_KEY)).toBe("general");
  });
});
