import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { insightDetailSchema, type CreateInsight } from "@atlas/shared";
import { test, expect, database } from "./fixtures";

const origin = "http://localhost:5174";
let created: string[] = [];
async function create(page: Page, fields: Partial<CreateInsight> = {}) {
  const response = await page.request.post("/api/insights", {
    headers: { Origin: origin },
    data: {
      body: "Practical atlas advice",
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
async function chooseCity(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Choose a city" }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
const row = (page: Page, title: string) =>
  page.getByRole("article", { name: title, exact: true, includeHidden: true });

test.beforeEach(async ({ signIn }) => {
  created = [];
  await signIn();
});
test.afterEach(async ({ page, signIn }) => {
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

test("city versus General search scope, category, sorting, clear, and history", async ({
  page,
}) => {
  await create(page, { title: "Tokyo cafe", body: "café coffee guide" });
  await create(page, {
    title: "General cafe",
    body: "café coffee guide",
    citySlugs: [],
  });
  await create(page, {
    title: "Buenos cafe",
    body: "café coffee guide",
    citySlugs: ["buenos-aires"],
  });
  await create(page, {
    title: "Tokyo commute",
    body: "coffee train guide",
    categorySlugs: ["transportation"],
  });
  await page.goto("/browse?city=tokyo");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(row(page, "General cafe")).toHaveCount(0);
  const search = page.getByRole("textbox", { name: "Search insights" });
  await search.fill("cafe");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=cafe/);
  await expect(row(page, "General cafe")).toBeVisible();
  await expect(row(page, "Buenos cafe")).toHaveCount(0);
  await expect(row(page, "Tokyo commute")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("relevance");
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Food", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Filter and sort insights" }).click();
  await page.getByRole("combobox", { name: "Sort insights" }).click();
  await page.getByRole("option", { name: "Top upvoted" }).click();
  expect(new URL(page.url()).searchParams.get("sort")).toBe("top");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(row(page, "General cafe")).toHaveCount(0);
  await page.goBack();
  await expect(search).toHaveValue("cafe");
  await expect(row(page, "General cafe")).toBeVisible();
  await chooseCity(page, "General");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(row(page, "General cafe")).toBeVisible();
  for (const q of ["123", "true", '"café coffee"']) {
    await page.goto(`/browse?city=general&q=${encodeURIComponent(q)}`);
    await expect(search).toHaveValue(q);
    await page.reload();
    await expect(search).toHaveValue(q);
  }
});

test("numbered pagination, URL normalization, and out-of-range correction", async ({
  page,
}) => {
  for (let index = 0; index < 22; index++)
    await create(page, { title: `Paged insight ${index}` });
  await page.goto("/browse?city=tokyo&page=2");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Page 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("21–22 of 22 insights")).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(20);
  const lastLink = page.getByRole("article").last().getByRole("link");
  await lastLink.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(0);
  await lastLink.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(lastLink).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scroll),
    )
    .toBeLessThan(2);
  await page.goBack();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.goto("/browse?city=tokyo&page=999");
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.goto(
    "/browse?city=tokyo&page=-1&sort=relevance&category=invalid&insight=invalid&unknown=1",
  );
  await expect(page.getByRole("article")).toHaveCount(20);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("page"))
    .toBe("1");
  const params = new URL(page.url()).searchParams;
  expect(params.get("sort")).toBe("newest");
  expect(params.has("category")).toBe(false);
  expect(params.has("insight")).toBe(false);
  expect(params.has("unknown")).toBe(false);
  await page.getByRole("button", { name: "Page 2", exact: true }).click();
  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  await expect(page.getByText("No matching insights")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
});

test("details preserve filters, scroll, focus, refresh, direct entry, and history", async ({
  page,
}) => {
  const insight = await create(page, {
    title: "Shareable advice",
    body: "First line\n\nSecond line",
    sourceUrl: "https://example.com/advice",
    places: [{ googlePlaceId: "browser-place-reference" }],
  });
  await page.goto("/browse?city=tokyo&category=food");
  const link = row(page, "Shareable advice").getByRole("link");
  await link.focus();
  const scroll = await page.evaluate(() => window.scrollY);
  await link.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("First line\n\nSecond line"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /View source/ })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  await expect(
    page.getByRole("dialog").getByText("1 place", { exact: true }),
  ).toBeVisible();
  const url = page.url();
  expect(new URL(url).searchParams.get("insight")).toBe(insight.id);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(link).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await page.goForward();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Shareable advice" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close insight" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("category")).toBe("food");
  await page.goto(url);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/browse");
  await expect(
    page.getByRole("heading", { name: "Browse insights" }),
  ).toBeFocused();
});

test("vote failures, duplicate prevention, shared counts, and top-sort refresh", async ({
  page,
}) => {
  const insight = await create(page, { title: "Vote on this" });
  await create(page, { title: "Newer advice" });
  await page.goto("/browse?city=tokyo&sort=top");
  await row(page, "Vote on this").getByRole("link").click();
  const dialog = page.getByRole("dialog");
  let fail = true;
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route(`**/api/insights/${insight.id}/vote`, async (route) => {
    requests++;
    if (fail) await route.fulfill({ status: 503, json: {} });
    else {
      await delayed;
      await route.continue();
    }
  });
  await dialog.getByRole("button", { name: "Upvote insight" }).click();
  await expect(dialog.getByRole("alert")).toContainText("unavailable");
  fail = false;
  await dialog.getByRole("button", { name: "Retry vote" }).click();
  await expect(
    dialog.getByRole("button", { name: "Upvote insight" }),
  ).toBeDisabled();
  // The underlying feed control participates in the same mutation lock.
  await expect(
    row(page, "Vote on this").getByRole("button", {
      name: "Upvote insight",
      includeHidden: true,
    }),
  ).toBeDisabled();
  release();
  await expect(
    dialog.getByRole("button", { name: "Remove upvote" }),
  ).toHaveText("1");
  expect(requests).toBe(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("article").first()).toHaveAttribute(
    "aria-label",
    "Vote on this",
  );
  await expect(
    row(page, "Vote on this").getByRole("button", { name: "Remove upvote" }),
  ).toHaveText("1");
  await page.unroute(`**/api/insights/${insight.id}/vote`);
  await row(page, "Vote on this")
    .getByRole("button", { name: "Remove upvote" })
    .click();
  await expect(
    row(page, "Vote on this").getByRole("button", { name: "Upvote insight" }),
  ).toHaveText("0");
  await row(page, "Vote on this").getByRole("link").click();
  await expect(
    dialog.getByRole("button", { name: "Upvote insight" }),
  ).toHaveText("0");
});

test("feed and detail loading, retry, empty, missing, and session expiry", async ({
  page,
}) => {
  const insight = await create(page, { title: "Retry advice" });
  await page.route("**/api/insights?*", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/browse?city=tokyo");
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await page.unroute("**/api/insights?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(row(page, "Retry advice")).toBeVisible();
  await page.route(`**/api/insights/${insight.id}`, (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await row(page, "Retry advice").getByRole("link").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "unavailable",
  );
  await page.unroute(`**/api/insights/${insight.id}`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Try again" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Retry advice" }),
  ).toBeVisible();
  await page.goto(`/browse?city=tokyo&insight=${randomUUID()}`);
  await expect(
    page.getByRole("heading", { name: "Insight not found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Browse" }).click();
  await page
    .getByRole("textbox", { name: "Search insights" })
    .fill("nomatchesanywhere");
  await expect(page.getByText("No matching insights")).toBeVisible();
  await database("revoke-sessions");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("superseded real search responses cannot replace newer results", async ({
  page,
}) => {
  await create(page, { title: "Coffee advice", body: "coffee" });
  await create(page, { title: "Tea advice", body: "tea" });
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured!: () => void;
  const arrived = new Promise<void>((resolve) => {
    captured = resolve;
  });
  await page.route("**/api/insights?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "coffee") {
      const response = await route.fetch();
      captured();
      await delayed;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await page.goto("/browse?city=tokyo");
  const search = page.getByRole("textbox", { name: "Search insights" });
  await search.fill("coffee");
  await search.press("Enter");
  await arrived;
  await expect(
    page.getByText("Loading insights…", { exact: true }),
  ).toBeVisible();
  await search.fill("tea");
  await search.press("Enter");
  await expect(row(page, "Tea advice")).toBeVisible();
  release();
  await expect(row(page, "Coffee advice")).toHaveCount(0);
  await expect(search).toHaveValue("tea");
});

for (const width of [375, 1440]) {
  test(`feed and dialog accessibility, long content, and focus at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await create(page, {
      title: null,
      body: `Long advice without a title.\n\n${"東京 café longcontent ".repeat(130)}`,
      citySlugs: [],
      places: [{ googlePlaceId: "browser-accessibility-reference" }],
    });
    await page.goto("/browse?city=general");
    await expect(page.getByRole("article")).toHaveCount(1);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`feed-${width}.png`),
      fullPage: true,
    });
    const link = page.getByRole("article").getByRole("link");
    await link.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Long advice without a title/)).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const bounds = await dialog.boundingBox();
    if (width === 375) expect(bounds!.height).toBe(800);
    await page.screenshot({ path: info.outputPath(`detail-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
  });
}
