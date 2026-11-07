import { expect, test, openAccountMenu } from "./fixtures";

test.beforeEach(async ({ signIn }) => {
  await signIn();
});
import AxeBuilder from "@axe-core/playwright";
import { readdir, readFile } from "node:fs/promises";

test("city preferences, preserved URL state, and history", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("atlas:last-city", "general"),
  );
  await page.goto("/browse?city=tokyo&q=coffee&page=3");
  const city = page.getByRole("combobox", { name: "Choose a city" });
  await expect(city).toHaveText("Tokyo");
  expect(
    await page.evaluate(() => localStorage.getItem("atlas:last-city")),
  ).toBe("general");
  const triggerBox = await city.boundingBox();
  await city.click();
  const popup = page.getByRole("listbox");
  const popupBox = await popup.boundingBox();
  expect(Math.abs(triggerBox!.width - popupBox!.width)).toBeLessThanOrEqual(1);
  await page.getByRole("option", { name: "Buenos Aires" }).click();
  await expect(page).toHaveURL(/city=buenos-aires/);
  expect(new URL(page.url()).searchParams.get("page")).toBe("1");
  expect(new URL(page.url()).searchParams.get("q")).toBe("coffee");
  expect(
    await page.evaluate(() => localStorage.getItem("atlas:last-city")),
  ).toBe("buenos-aires");
  await page.goBack();
  await expect(city).toHaveText("Tokyo");
  await page.goForward();
  await expect(city).toHaveText("Buenos Aires");
  await page.reload();
  await expect(city).toHaveText("Buenos Aires");
});

test("saved city, invalid URL, and inaccessible storage", async ({ page }) => {
  await page.goto("/browse");
  await page.evaluate(() => localStorage.setItem("atlas:last-city", "general"));
  await page.goto("/browse?city=not-a-city");
  await expect(page.getByRole("combobox")).toHaveText("General");
  await expect(page).toHaveURL(/city=general/);
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Blocked");
      },
    }),
  );
  await page.goto("/browse");
  await expect(page.getByRole("combobox")).toHaveText("San Francisco");
  await page.getByRole("combobox").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("option", { name: "San Francisco" }),
  ).toBeFocused();
  await page.keyboard.press("t");
  await expect(
    page.getByRole("option", { name: "Tokyo", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox")).toHaveText("Tokyo");
});

for (const width of [375, 768, 1440]) {
  test(`responsive shell and accessibility at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/browse");
    await expect(page.getByRole("combobox")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`shell-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("combobox").click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const popupBounds = await page.getByRole("listbox").boundingBox();
    expect(popupBounds!.x).toBeGreaterThanOrEqual(0);
    expect(popupBounds!.x + popupBounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`select-${width}.png`),
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("combobox")).toBeFocused();
    if (width < 768) {
      const menu = page.getByRole("button", { name: "Open navigation" });
      await menu.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Shift+Tab");
      expect(
        await page
          .getByRole("dialog")
          .evaluate((element) => element.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await menu.click();
    }
    await page.getByRole("link", { name: "Discover", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
    if (width >= 768)
      await expect(
        page.getByRole("link", { name: "Discover", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    expect(errors).toEqual([]);
  });
}

test("runtime excludes fixtures and fetches real reference data", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(new URL(request.url()).pathname);
  });
  await page.goto("/browse?city=tokyo");
  await expect(page.getByRole("combobox")).toHaveText("Tokyo");
  await expect(page.getByText("Design preview", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("No insights here yet")).toBeVisible();
  expect(apiRequests).toEqual(
    expect.arrayContaining(["/api/me", "/api/cities", "/api/categories"]),
  );
  expect(apiRequests).toContain("/api/insights");
  expect(apiRequests).not.toContain("/api/auth/get-session");
  if (process.env.ATLAS_BROWSER_MODE === "production") {
    const directory = new URL("../dist/assets/", import.meta.url);
    const files = (await readdir(directory)).filter((file) =>
      file.endsWith(".js"),
    );
    const bundle = (
      await Promise.all(
        files.map((file) => readFile(new URL(file, directory), "utf8")),
      )
    ).join("\n");
    expect(bundle).not.toContain(
      "A quiet corner for your next deep-work session",
    );
    expect(bundle).not.toContain("The best grocery tip? Go together.");
    expect(bundle).not.toContain("previewCities");
  }
});

test("200 percent zoom-equivalent reflow keeps city selection reachable", async ({
  page,
}) => {
  // A 1440×1000 browser at 200% zoom exposes a 720×500 CSS viewport.
  // CSS zoom is not browser zoom and breaks portal coordinate measurement.
  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto("/browse");
  await expect(page.getByRole("combobox")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "General" }).click();
  await expect(page.getByRole("combobox")).toHaveText("General");
});

for (const width of [375, 1440]) {
  test(`account dropdown navigation, focus, and accessibility at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await openAccountMenu(page);
    const trigger = page.getByRole("button", {
      name: "Account menu for Test User",
    });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect
      .poll(() =>
        menu.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    await expect(
      page.getByRole("link", { name: "My profile", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`account-menu-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    if (width < 768) await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("menuitem", { name: "My profile", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitem", { name: "Sign out", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(
      page.getByRole("menuitem", { name: "My profile", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "My profile", exact: true }),
    ).toBeVisible();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await openAccountMenu(page);
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });
}
