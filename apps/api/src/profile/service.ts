import type { Profile, UpdateProfile } from "@atlas/shared";
import { HttpError } from "../errors.js";
import type { createProfileRepository } from "./repository.js";

type Repository = ReturnType<typeof createProfileRepository>;

function toProfile(user: Awaited<ReturnType<Repository["find"]>>): Profile {
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    cohort: user.cohort,
    avatarUrl: null,
  };
}

export function createProfileService(repository: Repository) {
  return {
    async get(id: string) {
      return toProfile(await repository.find(id));
    },
    async update(id: string, input: UpdateProfile) {
      return toProfile(await repository.update(id, input));
    },
  };
}
