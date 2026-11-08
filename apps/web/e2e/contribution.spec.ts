import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  insightDetailSchema,
  profileSchema,
  type CreateInsight,
} from "@atlas/shared";
import type { Page } from "@playwright/test";
import { test, expect, database, openAccountMenu } from "./fixtures";
const origin = "http://localhost:5174";
let created: string[] = [];
async function create(page: Page, fields: Partial<CreateInsight> = {}) {
  const response = await page.request.post("/api/insights", {
    headers: { Origin: origin },
    data: {
      title: "Managed advice",
      body: "Practical contribution",
      categorySlugs: ["food"],
      citySlugs: ["tokyo"],
      ...fields,
    },
  });
  expect(response.status()).toBe(201);
  const insight = insightDetailSchema.parse(await response.json());
  created.push(insight.id);
  return insight;
}
async function menu(page: Page, title: string, action: string) {
  const article = page.getByRole("article", { name: title, exact: true });
  await article.getByRole("button", { name: "Insight actions" }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}
test.beforeEach(async ({ signIn }) => {
  created = [];
  await signIn();
});
test.afterEach(async ({ page, signIn }) => {
  if (!created.length) return;
  for (const id of created) {
    let response = await page.request.delete(`/api/insights/${id}`, {
      headers: { Origin: origin },
    });
    if (response.status() === 401) {
      await database("reset-limits");
      await signIn();
      response = await page.request.delete(`/api/insights/${id}`, {
        headers: { Origin: origin },
      });
    }
    expect([204, 404]).toContain(response.status());
  }
});

test("create preserves feed filters, validates required fields, and offers View insight", async ({
  page,
}) => {
  await page.goto("/browse?city=tokyo&category=food&sort=top");
  await page
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create insight",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  await expect(dialog.getByLabel("Insight", { exact: true })).toBeFocused();
  await dialog
    .getByLabel("Insight", { exact: true })
    .fill("First line\n\nSecond line");
  await dialog.getByLabel("Title", { exact: false }).fill("Created in browser");
  await dialog.getByLabel("Food", { exact: true }).check();
  await dialog.getByText("More details", { exact: true }).click();
  await expect(dialog.getByLabel("Tokyo", { exact: true })).toBeChecked();
  await dialog.getByLabel("San Francisco", { exact: true }).check();
  await dialog
    .getByLabel("Source URL", { exact: false })
    .fill("https://example.com/advice");
  const response = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/insights") && res.request().method() === "POST",
  );
  await dialog
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  const result = insightDetailSchema.parse(await (await response).json());
  created.push(result.id);
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("category")).toBe("food");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("top");
  await expect(
    page.getByText("Insight created.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View insight" }).click();
  await expect(
    page.getByRole("dialog", { name: "Created in browser" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /View source/ })).toHaveAttribute(
    "href",
    "https://example.com/advice",
  );
});

test("editing clears optional fields, replaces selections, preserves places, and returns to details", async ({
  page,
}) => {
  const insight = await create(page, {
    sourceUrl: "https://example.com",
    places: [
      { googlePlaceId: "preserved-place-a" },
      { googlePlaceId: "preserved-place-b" },
    ],
  });
  await page.goto("/browse?city=tokyo");
  await menu(page, "Managed advice", "Edit");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const editor = page.getByRole("dialog", { name: "Edit insight" });
  await editor.getByLabel("Title", { exact: false }).fill("");
  await editor.getByLabel("Source URL", { exact: false }).fill("");
  await editor.getByLabel("Tokyo", { exact: true }).uncheck();
  await editor.getByLabel("Travel", { exact: true }).check();
  const request = page.waitForRequest(
    (req) =>
      req.method() === "PATCH" && req.url().endsWith(`/insights/${insight.id}`),
  );
  await editor.getByRole("button", { name: "Save changes" }).click();
  const payload: unknown = (await request).postDataJSON();
  expect(payload).not.toHaveProperty("places");
  await expect(
    page.getByRole("dialog", { name: "Insight details" }),
  ).toBeVisible();
  const updated = insightDetailSchema.parse(
    await (await page.request.get(`/api/insights/${insight.id}`)).json(),
  );
  expect(updated).toMatchObject({
    title: null,
    sourceUrl: null,
    cities: [],
    places: insight.places,
  });
  expect(updated.categories.map((category) => category.slug)).toEqual(
    expect.arrayContaining(["food", "travel"]),
  );
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Insight details" }),
  ).toBeVisible();
});

test("dirty editor guards dismissal and Back, retains failed values, and blocks duplicate submission", async ({
  page,
}) => {
  await page.getByRole("combobox", { name: "Choose a city" }).click();
  await page.getByRole("option", { name: "General", exact: true }).click();
  await page
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Create insight",
    exact: true,
  });
  await editor
    .getByLabel("Insight", { exact: true })
    .fill("Keep my unsaved advice");
  await editor.getByLabel("Food", { exact: true }).check();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(editor.getByLabel("Insight", { exact: true })).toHaveValue(
    "Keep my unsaved advice",
  );
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/insights", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    await pending;
    await route.fulfill({ status: 503, json: {} });
  });
  await editor
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Create insight", exact: true }),
  ).toBeDisabled();
  release();
  await expect(editor.getByRole("alert")).toContainText("unavailable");
  expect(requests).toBe(1);
  await expect(editor.getByLabel("Insight", { exact: true })).toHaveValue(
    "Keep my unsaved advice",
  );
  await page.goBack();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Discard changes" }).click();
  await expect(editor).toHaveCount(0);
});

test("profile validates and saves identity, clears cohort, and warns on navigation", async ({
  page,
}) => {
  const original = profileSchema.parse(
    await (await page.request.get("/api/me")).json(),
  );
  try {
    await openAccountMenu(page);
    await page
      .getByRole("menuitem", { name: "My profile", exact: true })
      .click();
    await page.getByLabel("Display name").fill("Browser Minervan");
    await page.getByLabel("Cohort", { exact: false }).fill("2027");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByLabel("Cohort", { exact: false })).toBeFocused();
    await page.getByLabel("Cohort", { exact: false }).fill("M27");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByText("Profile saved.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Account menu for Browser Minervan" }),
    ).toBeVisible();
    await page.getByLabel("Cohort", { exact: false }).fill("");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByText("Profile saved.", { exact: true }),
    ).toBeVisible();
    expect(
      profileSchema.parse(await (await page.request.get("/api/me")).json())
        .cohort,
    ).toBeNull();
    await page.getByLabel("Display name").fill("Unsaved name");
    await page.getByRole("link", { name: "Browse", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Cancel", exact: true })
      .last()
      .click();
    await expect(page.getByLabel("Display name")).toHaveValue("Unsaved name");
    await page.getByRole("link", { name: "Browse", exact: true }).click();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/\/browse/);
  } finally {
    await page.request.patch("/api/me", {
      headers: { Origin: origin },
      data: { displayName: original.displayName, cohort: original.cohort },
    });
  }
});

test("My insights spans cities, uses shared details, and corrects pagination after delete", async ({
  page,
}) => {
  for (let index = 0; index < 21; index++)
    await create(page, {
      title: `Owned ${index}`,
      citySlugs: index % 2 ? [] : ["buenos-aires"],
    });
  await page.goto("/profile?page=2");
  await expect(page.getByRole("article")).toHaveCount(1);
  const lastTitle = await page.getByRole("article").getAttribute("aria-label");
  await page.getByRole("article").getByRole("link").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close insight" }).click();
  await expect(page).toHaveURL(/page=2/);
  await menu(page, lastTitle!, "Delete");
  await expect(page.getByRole("article", { includeHidden: true })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Delete insight", exact: true })
    .click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole("article")).toHaveCount(20);
  await expect(
    page.getByText("Insight deleted.", { exact: true }),
  ).toBeVisible();
});

test("menus isolate row activation and report clipboard success and failure", async ({
  page,
  context,
}) => {
  const insight = await create(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/browse?city=tokyo");
  const trigger = page
    .getByRole("article")
    .getByRole("button", { name: "Insight actions" });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page.getByRole("menuitem")).toHaveText([
    "Copy link",
    "Edit",
    "Delete",
  ]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu(page, "Managed advice", "Copy link");
  await expect(
    page.getByRole("status").filter({ hasText: "Link copied." }),
  ).toHaveText("Link copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${origin}/browse?insight=${insight.id}`);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("Denied")),
    });
  });
  await menu(page, "Managed advice", "Copy link");
  await expect(page.getByLabel("Insight link")).toHaveValue(copied);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.clearCookies();
  await page.goto(copied);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  // Normal sign-in must preserve and reopen the copied destination.
  const { fillSignIn } = await import("./fixtures");
  await fillSignIn(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Managed advice" }),
  ).toBeVisible();
});

test("non-authors only see Copy link, including in details", async ({
  page,
  browser,
}) => {
  const insight = await create(page);
  const context = await browser.newContext({ baseURL: origin });
  const other = await context.newPage();
  try {
    await other.goto("/sign-up");
    await other.getByLabel("Name", { exact: true }).fill("Other Minervan");
    await other
      .getByLabel("University email")
      .fill(`reader-${randomUUID()}@minerva.edu`);
    await other
      .getByLabel("Password", { exact: true })
      .fill("browser-password-123");
    await other
      .getByLabel("Confirm password", { exact: true })
      .fill("browser-password-123");
    await other
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      other.getByRole("combobox", { name: "Choose a city" }),
    ).toBeVisible();
    await other.goto("/browse?city=tokyo");
    await other
      .getByRole("article")
      .getByRole("button", { name: "Insight actions" })
      .click();
    await expect(other.getByRole("menuitem")).toHaveText(["Copy link"]);
    await other.keyboard.press("Escape");
    await other.getByRole("article").getByRole("link").click();
    await other
      .getByRole("dialog")
      .getByRole("button", { name: "Insight actions" })
      .click();
    await expect(other.getByRole("menuitem")).toHaveText(["Copy link"]);
    const denied = await other.request.patch(`/api/insights/${insight.id}`, {
      headers: { Origin: origin },
      data: { body: "Forbidden edit" },
    });
    expect(denied.status()).toBe(403);
  } finally {
    await context.close();
  }
});

for (const width of [375, 1440])
  test(`contribution accessibility, nested menus, and focus at ${width}px`, async ({
    page,
  }, info) => {
    await create(page, { title: "Long advice 日本語 ".repeat(6) });
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/browse?city=tokyo");
    await page
      .getByRole("button", { name: "Create insight", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("dialog")
      .getByText("More details", { exact: true })
      .click();
    await expect(page.getByLabel("Tokyo", { exact: true })).toBeChecked();
    await page.getByRole("dialog").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: info.outputPath(`contribution-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Create insight", exact: true }),
    ).toBeFocused();
    await page.getByRole("article").getByRole("link").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Insight actions" })
      .click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit insight" }),
    ).toBeVisible();
    await page.getByLabel("Insight", { exact: true }).fill("Unsaved advice");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit insight" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/profile");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`profile-${width}.png`),
      fullPage: true,
    });
  });

test("delete failure retains the insight and confirmation supports retry", async ({
  page,
}) => {
  const insight = await create(page);
  await page.goto(`/browse?city=tokyo&insight=${insight.id}`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Insight actions" })
    .click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.route(`**/api/insights/${insight.id}`, async (route) => {
    if (route.request().method() === "DELETE")
      await route.fulfill({ status: 503, json: {} });
    else await route.continue();
  });
  const confirmation = page.getByRole("alertdialog");
  await confirmation
    .getByRole("button", { name: "Delete insight", exact: true })
    .click();
  await expect(confirmation.getByRole("alert")).toContainText("unavailable");
  expect((await page.request.get(`/api/insights/${insight.id}`)).status()).toBe(
    200,
  );
  await page.unroute(`**/api/insights/${insight.id}`);
  await confirmation
    .getByRole("button", { name: "Delete insight", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("session expiry while contributing clears the private form", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Create insight",
    exact: true,
  });
  await editor
    .getByLabel("Insight", { exact: true })
    .fill("Private unsaved contribution");
  await editor.getByLabel("Food", { exact: true }).check();
  await database("revoke-sessions");
  await editor
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Private unsaved contribution", { exact: true }),
  ).toHaveCount(0);
});

test("profile failure retains input, retry saves it, and My insights recovers from an outage", async ({
  page,
}) => {
  const original = profileSchema.parse(
    await (await page.request.get("/api/me")).json(),
  );
  try {
    await page.route("**/api/insights?**", async (route) => {
      if (new URL(route.request().url()).searchParams.get("author") === "me")
        await route.fulfill({ status: 503, json: {} });
      else await route.continue();
    });
    await page.goto("/profile");
    await expect(
      page.getByRole("region", { name: "My insights" }).getByRole("alert"),
    ).toContainText("unavailable");
    await page.unroute("**/api/insights?**");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByText("No insights yet", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Display name").fill("Retained after failure");
    await page.route("**/api/me", async (route) => {
      if (route.request().method() === "PATCH")
        await route.fulfill({ status: 503, json: {} });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("alert")).toContainText("unavailable");
    await expect(page.getByLabel("Display name")).toHaveValue(
      "Retained after failure",
    );
    await page.unroute("**/api/me");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByText("Profile saved.", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.request.patch("/api/me", {
      headers: { Origin: origin },
      data: { displayName: original.displayName, cohort: original.cohort },
    });
  }
});

test("pristine contribution forms close on in-app Back", async ({ page }) => {
  await page.getByRole("combobox", { name: "Choose a city" }).click();
  await page.getByRole("option", { name: "Tokyo", exact: true }).click();
  await page
    .getByRole("button", { name: "Create insight", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Create insight", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Choose a city" }),
  ).toHaveText("San Francisco");
});
