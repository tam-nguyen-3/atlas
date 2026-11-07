import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavigationSheet } from "./sheet";
import { Button } from "./button";
afterEach(cleanup);
test("navigation sheet closes with Escape and restores trigger focus", async () => {
  const user = userEvent.setup();
  render(
    <NavigationSheet>
      {(close) => (
        <a href="/browse" onClick={close}>
          Browse
        </a>
      )}
    </NavigationSheet>,
  );
  const trigger = screen.getByRole("button", { name: "Open navigation" });
  await user.click(trigger);
  expect(screen.getByRole("dialog")).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
test("busy buttons retain their label and block duplicate actions", () => {
  render(<Button busy>Save changes</Button>);
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
});
