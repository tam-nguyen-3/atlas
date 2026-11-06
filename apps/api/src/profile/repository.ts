import type { UpdateProfile } from "@atlas/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { users } from "../db/schema.js";

export function createProfileRepository(db: Db) {
  return {
    async find(id: string) {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    },
    async update(id: string, input: UpdateProfile) {
      const [user] = await db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user;
    },
  };
}
