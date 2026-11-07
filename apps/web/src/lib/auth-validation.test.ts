import { expect, test } from "vitest";
import { safeReturnTo, signInSchema, signUpSchema } from "./auth-validation";

const valid = {
  name: " Ada ",
  email: "Ada@MINERVA.EDU",
  password: "a-password",
  confirmation: "a-password",
};
test("sign-up matches server name, email-domain, and password rules", () => {
  expect(signUpSchema.parse(valid).name).toBe("Ada");
  expect(
    signUpSchema.safeParse({ ...valid, email: "ada@uni.minerva.edu" }).success,
  ).toBe(true);
  for (const email of [
    "ada@gmail.com",
    "ada@sub.minerva.edu",
    "ada@minerva.edu.evil.test",
    "not-email",
  ])
    expect(signUpSchema.safeParse({ ...valid, email }).success).toBe(false);
  for (const name of [" ", "a".repeat(101)])
    expect(signUpSchema.safeParse({ ...valid, name }).success).toBe(false);
  for (const password of ["short", "a".repeat(129)])
    expect(
      signUpSchema.safeParse({ ...valid, password, confirmation: password })
        .success,
    ).toBe(false);
  expect(
    signUpSchema.safeParse({ ...valid, confirmation: "different" }).success,
  ).toBe(false);
});
test("email is trimmed and passwords remain literal; sign-in does not enforce sign-up minimum length", () => {
  expect(
    signInSchema.parse({ email: " ada@minerva.edu ", password: " x " }),
  ).toEqual({ email: "ada@minerva.edu", password: " x " });
});
test.each([
  undefined,
  null,
  [],
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/sign-in?returnTo=/sign-up",
  "/sign-up",
  "/unknown",
  "/%2f%2fevil.test",
  "/browse\n",
  "javascript:alert(1)",
])("rejects unsafe or looping return destination %s", (value) => {
  expect(safeReturnTo(value)).toBe("/browse");
});
test.each([
  "/browse?city=tokyo&q=coffee&page=3#insight",
  "/profile#cohort",
  "/discover",
  "/agent",
])("preserves internal destination %s", (value) =>
  expect(safeReturnTo(value)).toBe(value),
);

test("strips nested auth parameters while retaining destination filters and hash", () => {
  expect(
    safeReturnTo(
      "/browse?returnTo=%2Fbrowse%3FreturnTo%3D%252Fbrowse&city=tokyo&q=coffee#saved",
    ),
  ).toBe("/browse?city=tokyo&q=coffee#saved");
  expect(safeReturnTo("/browse?returnTo=%2Fbrowse")).toBe("/browse");
});
