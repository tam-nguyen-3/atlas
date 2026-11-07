import type { createReferenceRepository } from "./repository.js";

export function createReferenceService(
  repository: ReturnType<typeof createReferenceRepository>,
) {
  return {
    cities: () => repository.cities(),
    categories: () => repository.categories(),
  };
}
