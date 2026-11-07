import { test as base, expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

export const credentials = {
  email: process.env.TEST_USER_EMAIL!,
  password: process.env.TEST_USER_PASSWORD!,
};
export async function database(command: "reset-limits" | "revoke-sessions") {
  await promisify(execFile)(
    "pnpm",
    [
      "--filter",
      "@atlas/api",
      "exec",
      "tsx",
      "src/test/browser-db.ts",
      command,
    ],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    },
  );
}
export async function fillSignIn(page: Page, password = credentials.password) {
  await page.getByLabel("University email").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
}
export const test = base.extend<{
  signIn: () => Promise<void>;
  resetLimits: void;
}>({
  resetLimits: [
    async ({ page }, use) => {
      void page;
      await database("reset-limits");
      await use();
    },
    { auto: true },
  ],
  signIn: async ({ page }, use) => {
    await use(async () => {
      await page.goto("/sign-in");
      await fillSignIn(page);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByRole("combobox", { name: "Choose a city" }),
      ).toBeVisible();
    });
  },
});
export { expect };

export async function openAccountMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /^Account menu for / });
  if (!(await trigger.isVisible()))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await trigger.click();
}
