import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { BrowseSearch } from "./browse-search";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function setup() {
  vi.useFakeTimers();
  const commit = vi.fn();
  const result = render(
    <BrowseSearch committed="" navigationKey="initial" commit={commit}>
      {null}
    </BrowseSearch>,
  );
  return {
    ...result,
    commit,
    input: screen.getByRole("textbox", { name: "Search insights" }),
  };
}
test("debounces, immediately submits Enter, and cancels timers when cleared", async () => {
  const { input, commit } = setup();
  fireEvent.change(input, { target: { value: "coffee" } });
  await act(() => vi.advanceTimersByTime(299));
  expect(commit).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(1));
  expect(commit).toHaveBeenLastCalledWith("coffee");
  fireEvent.change(input, { target: { value: "tea" } });
  fireEvent.submit(screen.getByRole("search"));
  expect(commit).toHaveBeenLastCalledWith("tea");
  fireEvent.change(input, { target: { value: "pending" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
  await act(() => vi.advanceTimersByTime(500));
  expect(commit).not.toHaveBeenCalledWith("pending");
});
test("does not search during composition and waits after composition ends", async () => {
  const { input, commit } = setup();
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: "東京" } });
  fireEvent.submit(screen.getByRole("search"));
  await act(() => vi.advanceTimersByTime(500));
  expect(commit).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await act(() => vi.advanceTimersByTime(300));
  expect(commit).toHaveBeenCalledExactlyOnceWith("東京");
});
test("history changes cancel a pending search and restore the URL query", async () => {
  const { input, commit, rerender } = setup();
  fireEvent.change(input, { target: { value: "pending" } });
  rerender(
    <BrowseSearch committed="previous" navigationKey="back" commit={commit}>
      {null}
    </BrowseSearch>,
  );
  expect(input).toHaveValue("previous");
  await act(() => vi.advanceTimersByTime(500));
  expect(commit).not.toHaveBeenCalled();
});
