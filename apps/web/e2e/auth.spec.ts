import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  credentials,
  database,
  fillSignIn,
  openAccountMenu,
} from "./fixtures";

test("repeated logo clicks on auth screens never nest return destinations", async ({
  page,
}) => {
  for (const path of ["/sign-in", "/sign-up"]) {
    await page.goto(
      `${path}?returnTo=${encodeURIComponent("/browse?returnTo=%2Fbrowse")}`,
    );
    let expected: string | undefined;
    for (let i = 0; i < 3; i++) {
      await page.getByRole("link", { name: "Atlas home" }).click();
      await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fbrowse$/);
      expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/browse");
      expected ??= page.url();
      expect(page.url()).toBe(expected);
    }
  }
});

test("protected destinations survive both auth screens, including query and hash", async ({
  page,
}) => {
  await page.goto("/discover?city=tokyo&q=coffee#saved");
  await expect(page).toHaveURL(/\/sign-in\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/discover?city=tokyo&q=coffee#saved",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Make yourself at home" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await fillSignIn(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/discover\?city=tokyo&q=coffee#saved$/);
  await expect(
    page.getByRole("heading", { name: "Discover", exact: true }),
  ).toBeVisible();
});

test("external return destinations fall back to Browse", async ({ page }) => {
  await page.goto("/sign-in?returnTo=https%3A%2F%2Fevil.test");
  await fillSignIn(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/browse");
});

test("sign-up validates fields, focuses errors, and creates a real session", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill(" New Minervan ");
  await page.getByLabel("University email").fill("new@gmail.com");
  await page.getByLabel("Password", { exact: true }).fill("new-test-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("Use your minerva.edu or uni.minerva.edu email address."),
  ).toBeVisible();
  await expect(page.getByLabel("University email")).toBeFocused();
  await expect(page.getByText("Passwords must match.")).toBeVisible();
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await page
    .getByLabel("University email")
    .fill(`new-${randomUUID()}@uni.minerva.edu`);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("new-test-password");
  const sent: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/sign-up/email"))
      sent.push(request.postDataJSON() as Record<string, unknown>);
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("combobox")).toBeVisible();
  await expect(page.getByText("New Minervan", { exact: true })).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(Object.keys(sent[0]!).sort()).toEqual(["email", "name", "password"]);
  await page.reload();
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("duplicate account errors preserve values and focus the email field", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Another name");
  await page.getByLabel("University email").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill(credentials.password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(
      "An account with this email already exists. Sign in instead.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("University email")).toBeFocused();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Another name",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    credentials.password,
  );
});

test("invalid credentials preserve input and recover after the real rate limit", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await fillSignIn(page, "wrong-test-password");
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  for (let i = 0; i < 4; i++) {
    const [response] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().endsWith("/api/auth/sign-in/email"),
      ),
      submit.click(),
    ]);
    expect(response.status()).toBe(i < 3 ? 401 : 429);
    if (i < 3)
      await expect(page.getByRole("alert")).toHaveText(
        "Email or password is incorrect.",
      );
  }
  await expect(page.getByRole("alert")).toHaveText(
    "Too many attempts. Wait a moment before trying again.",
  );
  await expect(submit).toBeDisabled();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "wrong-test-password",
  );
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await expect(submit).toBeEnabled({ timeout: 15000 });
  await submit.click();
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("session verification recovery never resubmits accepted credentials", async ({
  page,
}) => {
  let block = true;
  let submissions = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/sign-in/email")) submissions++;
  });
  await page.route("**/api/me", async (route) => {
    if (block)
      await route.fulfill({
        status: 503,
        json: { error: { code: "INTERNAL_ERROR", message: "Unavailable" } },
      });
    else await route.continue();
  });
  await page.goto("/sign-in");
  await fillSignIn(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Atlas is unavailable right now. Try again.",
  );
  await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
  block = false;
  await page.getByRole("button", { name: "Retry session check" }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
  expect(submissions).toBe(1);
});

test("network failure retains credentials and offers a manual retry", async ({
  page,
}) => {
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.abort("failed"),
  );
  await page.goto("/sign-in");
  await fillSignIn(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("couldn’t be reached");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    credentials.password,
  );
  await page.unroute("**/api/auth/sign-in/email");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("server unavailability does not masquerade as a signed-out session", async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText(
    "Atlas is unavailable right now. Try again.",
  );
  expect(new URL(page.url()).pathname).toBe("/browse");
  await page.unroute("**/api/me");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("reference data errors can be retried without signing out", async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.route("**/api/categories", (route) =>
    route.fulfill({ status: 500, json: {} }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText(
    "Atlas is unavailable right now. Try again.",
  );
  await expect(
    page.getByRole("button", {
      name: "Account menu for Test User",
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/categories");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
});

test("revocation is detected on protected navigation and preserves the return path", async ({
  page,
  signIn,
}) => {
  await signIn();
  await database("revoke-sessions");
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toContain(
    "/discover",
  );
  await expect(
    page.getByRole("heading", { name: "Discover", exact: true }),
  ).toHaveCount(0);
});

test("protected 401 clears content but keeps the city preference", async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.evaluate(() => localStorage.setItem("atlas:last-city", "general"));
  await page.route("**/api/categories", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "UNAUTHORIZED", message: "Sign in" } },
    }),
  );
  await page.reload();
  await expect(page).toHaveURL(/\/sign-in/);
  expect(
    await page.evaluate(() => localStorage.getItem("atlas:last-city")),
  ).toBe("general");
});

test("sign-out failure keeps identity; confirmed retry removes access", async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.route("**/api/auth/sign-out", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } }),
  );
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Atlas is unavailable right now. Try again.",
  );
  await expect(
    page.getByRole("menu").getByText("Test User", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/auth/sign-out");
  await page.getByRole("menuitem", { name: "Retry sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.goto("/browse");
  await expect(page).toHaveURL(/\/sign-in\?/);
});

test("late data from a signed-out account cannot restore its identity or content", async ({
  page,
  signIn,
}) => {
  await signIn();
  let release!: () => void;
  let captured!: () => void;
  const arrived = new Promise<void>((resolve) => {
    captured = resolve;
  });
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let blockPreviousUser = true;
  await page.route("**/api/categories", async (route) => {
    if (!blockPreviousUser) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    captured();
    await delayed;
    // Cancellation may already have closed the first user's request.
    await route.fulfill({ response }).catch(() => {});
  });
  await page.reload();
  await arrived;
  await expect(
    page.getByText("Loading your cities and categories…"),
  ).toBeVisible();
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  blockPreviousUser = false;
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Second Student");
  await page
    .getByLabel("University email")
    .fill(`second-${randomUUID()}@minerva.edu`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("another-test-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("another-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("combobox")).toBeVisible();
  release();
  await expect(page.getByText("Second Student", { exact: true })).toBeVisible();
  await expect(page.getByText("Test User", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discover", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Second Student", { exact: true })).toBeVisible();
});

test("focus and reconnect revalidate the authoritative session", async ({
  page,
  signIn,
}) => {
  await signIn();
  const focusCheck = page.waitForResponse((response) =>
    response.url().endsWith("/api/me"),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  expect((await focusCheck).status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await database("revoke-sessions");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toContain("/browse");
});

for (const width of [375, 1440])
  test(`auth accessibility and keyboard at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-up");
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
    await page.getByLabel("Name", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("University email")).toBeFocused();
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
    await page.screenshot({
      path: info.outputPath(`sign-up-${width}.png`),
      fullPage: true,
    });
  });
