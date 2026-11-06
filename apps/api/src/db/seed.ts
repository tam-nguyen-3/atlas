import { sql } from "drizzle-orm";
import { createDb, requireEnv, type Db } from "./client.js";
import { categories, cities } from "./schema.js";

export const CITIES = [
  {
    slug: "san-francisco",
    name: "San Francisco",
    country: "United States",
    timezone: "America/Los_Angeles",
    sortOrder: 1,
  },
  {
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    timezone: "Asia/Tokyo",
    sortOrder: 2,
  },
  {
    slug: "buenos-aires",
    name: "Buenos Aires",
    country: "Argentina",
    timezone: "America/Argentina/Buenos_Aires",
    sortOrder: 3,
  },
];

// Icons are Lucide names, the icon set shadcn/ui uses.
export const CATEGORIES = [
  { slug: "food", name: "Food", icon: "utensils", sortOrder: 1 },
  {
    slug: "transportation",
    name: "Transportation",
    icon: "bus",
    sortOrder: 2,
  },
  { slug: "living", name: "Living", icon: "house", sortOrder: 3 },
  {
    slug: "health-fitness",
    name: "Health & Fitness",
    icon: "heart-pulse",
    sortOrder: 4,
  },
  { slug: "shopping", name: "Shopping", icon: "shopping-bag", sortOrder: 5 },
  { slug: "travel", name: "Travel", icon: "plane", sortOrder: 6 },
  { slug: "study-work", name: "Study & Work", icon: "book-open", sortOrder: 7 },
  { slug: "activities", name: "Activities", icon: "ticket", sortOrder: 8 },
];

// Safe to re-run: restores the values above and never deletes rows, because
// insights may reference a city or category that has left this list.
export async function seedReferenceData(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(cities)
      .values(CITIES)
      .onConflictDoUpdate({
        target: cities.slug,
        set: {
          name: sql`excluded.name`,
          country: sql`excluded.country`,
          timezone: sql`excluded.timezone`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
    await tx
      .insert(categories)
      .values(CATEGORIES)
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: sql`excluded.name`,
          icon: sql`excluded.icon`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
  });
}

if (import.meta.main) {
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    await seedReferenceData(db);
    console.log(
      `Seeded ${CITIES.length} cities and ${CATEGORIES.length} categories.`,
    );
  } finally {
    await pool.end();
  }
}
