import { asc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { categories, cities } from "../db/schema.js";

export function createReferenceRepository(db: Db) {
  return {
    cities: () =>
      db.select().from(cities).orderBy(asc(cities.sortOrder), asc(cities.slug)),
    categories: () =>
      db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.slug)),
  };
}
