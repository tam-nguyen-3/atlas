---
version: alpha
colors:
  background: "#F7F8FA"
  surface: "#FFFFFF"
  foreground: "#242424"
  muted: "#626874"
  primary: "#F0B91E"
  accent: "#785700"
  accent-soft: "#FFF7DC"
  border: "#DFE2E7"
  control-border: "#7C828C"
  danger: "#B42318"
  success: "#236440"
  warning: "#8C3B10"
typography:
  body:
    fontFamily: '"Source Sans 3", system-ui, sans-serif'
    fontSize: "17px"
    lineHeight: "1.55"
  heading:
    fontFamily: '"Manrope", system-ui, sans-serif'
rounded:
  control: "0.625rem"
spacing:
  page: "24px"
  mobile-page: "20px"
components:
  button:
    rounded: "{rounded.control}"
---

# Atlas design foundations

## Overview

Atlas is a student knowledge commons for Minerva's rotation cities. The interface should feel like a thoughtfully kept campus noticeboard: practical, personal, and easy to scan. This is a product interface, not a marketing landing page. Preserve the wireframes' sparse hierarchy; no hero illustration, card grid, gradients, or decorative city stereotypes.

The small tilted gold wordmark tile is the signature. Everything around it stays quiet. This initial supporting palette and typography are proposed for the first user review, not an assertion of user approval.

Audience: English-speaking Minerva students and alumni, on phones and laptops across global rotation cities including Tokyo. UI language is English; user content may use other scripts through system fallbacks. No Japan-specific identity, payment, or regulated data collection is introduced.

## Colors

Runtime CSS custom properties in `apps/web/src/styles.css` are canonical. This document mirrors them; update both when changing the system. Tailwind's `@theme inline` aliases reference those properties, and shared primitives consume the aliases or properties directly. No independent JavaScript theme.

Gold fill uses charcoal text. Dark gold (`accent` and `ring`) carries links, selected navigation, and focus outlines. Brand gold is not a warning color. Danger, success, and warning have independent semantic tokens. Muted text remains readable on white and light neutral backgrounds. Decorative dividers use `border`; input and popup boundaries use `control-border`.

## Typography

Manrope 600/700 is reserved for the wordmark and headings; Source Sans 3 400/600 carries prose and controls. Both are bundled locally with system fallbacks. Body is 17px/1.55; mobile insight prose is 16px. City heading is 34px desktop and 29px mobile. Long content wraps rather than clipping important information.

## Layout

960px content width, 24px outer gutters, 20px below 768px. Desktop has horizontal navigation; mobile has a modal left navigation sheet. The document owns scrolling. No fixed-height feed or hidden scrollbar. Interactive controls are at least 44px high; static metadata and badges stay compact.

The city heading anchors each view. Search and categories lead into flat feed rows with light dividers. Both development and production show the authenticated shell with real reference data. Browse renders live, paginated insights; sample insights never appear at runtime. Feed rows retain the flat, lightly divided layout. Details use a centered, scrollable modal on desktop and a full-height dialog below 768px. Auth screens use a centered, 440px-wide form with the same wordmark, type, and surface tokens. The display name replaces the top-level My profile link and opens the account dropdown beside desktop navigation; narrow screens use the same dropdown inside the navigation sheet. The non-modal menu contains My profile and Sign out, with inline sign-out failure/retry feedback; the mobile navigation sheet retains modal focus isolation.

## Elevation & Depth

Static content stays flat. Select popups and the mobile floating action may use a restrained shadow. Layer tokens: dropdown 200, backdrop 500, navigation sheet 700, nested account/insight menu 710, editor backdrop/dialog 720/730, confirmation backdrop/dialog 740/750. The account menu portals above the sheet and stays within viewport bounds. Portal overlays avoid clipping.

## Shapes

Controls use a 10px radius; badges use 5px; avatars are circles. The wordmark tile alone has an asymmetric corner and small rotation.

## Components

| Capability         | Canonical owner                | Contract / mapping                                                                                                                           | Verification                            |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Button             | `components/ui/button.tsx`     | brand/outline/ghost/danger; disabled and busy; `--primary`, `--danger`, `--radius`                                                           | component test, browser                 |
| Input              | `components/ui/input.tsx`      | label supplied by caller; `--control-border`, `--radius`                                                                                     | browser                                 |
| Badge              | `components/ui/badge.tsx`      | static metadata, no pointer affordance                                                                                                       | browser                                 |
| Select/Listbox     | `components/ui/select.tsx`     | authored Radix popup, trigger-width matching, keyboard/typeahead, checkmark                                                                  | browser keyboard/popup                  |
| Account menu       | `components/account-menu.tsx`  | Radix dropdown; display-name trigger, profile link, confirmed sign-out, keyboard/typeahead, Escape and focus restoration; `--z-account-menu` | browser keyboard, mobile, accessibility |
| Navigation overlay | `components/ui/sheet.tsx`      | modal Radix dialog, Escape, focus trap/restoration                                                                                           | component test, browser                 |
| Scrollbar          | `src/styles.css`               | global thumb/track/hover/active and forced-colors fallback                                                                                   | computed styles/browser                 |
| City selection     | `lib/city.ts` and browse route | URL → saved → San Francisco; only explicit selection persists                                                                                | unit/browser                            |

Browse behavior owners: `lib/browse-state.ts` validates URL filters and paging; `components/browse-search.tsx` owns debounced, IME-safe search and immediate clear/Enter; `lib/insights.ts` owns viewer-scoped feed/detail queries and vote synchronization. `components/insight.tsx` shares metadata, place counts, and voting between feed and details. `components/insight-dialog.tsx` uses the existing Radix dialog dependency with the backdrop/sheet layer tokens, focus trapping, Escape, and focus restoration.

Browse uses numbered pagination with 20 results per page and bounded page-number controls. Search includes General for a selected city, following the API contract; a small scope hint explains this. Loading, empty, no-results, retry, and missing-detail states use inline feedback. Votes wait for server confirmation, share a per-insight mutation lock across mounted controls, update cached counts, and revalidate lists for ranking changes. Detail URLs carry an `insight` UUID alongside feed filters; closing uses Back for a feed-opened dialog and replaces the URL for direct entry. Focus returns to the originating row, falling back to the Browse heading. Place names and cards remain unavailable until Phase 6.

Visual tokens map by name to `--background`, `--surface`, `--foreground`, `--muted`, `--primary`, `--accent`, `--accent-soft`, `--border`, `--control-border`, `--danger`, `--success`, `--warning`. Typography maps to `--font-body` and `--font-heading`; radius maps to `--radius`. Component styles own the documented layout dimensions.

Existing `docs/product.md` and Phase 5 agreed behavior in `docs/plan.md` remain the workflow contract. Authentication uses React Hook Form and Zod with app-owned validation (`noValidate`). Inline field feedback references stable help IDs, exposes invalid state, and focuses the first invalid field. Server field errors focus after submission re-enables inputs. Password inputs are masked by default, support managers/paste, and use one shared visibility control. Form values stay in memory after failures; credentials are never persisted. Busy controls retain their geometry, and the email-help and form-feedback regions reserve space for error copy. IME composition does not submit the form.

`/api/me` is the single session/profile query. Protected content waits for confirmation. Atlas and native auth failures have separate transport parsers; only a protected 401 establishes session loss. Unavailability has an inline retry state. An accepted sign-in/sign-up followed by unavailable session verification offers **Retry session check** without resending credentials. Auth rate limits show a retry countdown. Sign-out is pessimistic: success requires server confirmation; failure keeps identity and offers **Retry sign out**. Session loss or identity change cancels requests and clears private query/mutation/route caches while retaining the city preference.

Shared owners added for this flow: `components/ui/password-input.tsx` (masked input and visibility), `components/ui/request-state.tsx` (loading/error/retry and rate-limit delay), `lib/errors.ts` (transport error messages), and `lib/session.ts` (session/cache lifecycle). The current auth and shell use inline feedback; no toast system is introduced. The existing product/API specs and Phase 5 tracker continue to own workflow policy; no additional UX-contract document duplicates them.

## Contribution and profile

Insight actions use the shared shadcn/Radix dropdown owner in `components/ui/dropdown-menu.tsx`, with `components/insight-menu.tsx` reused across feed rows, insight details, and My insights. Existing tokens and flat feed layouts remain canonical.

- Place a horizontal three-dot (`⋯`) button at the top right of each insight header. Keep it visible on desktop and mobile, with a minimum 44px touch target, an accessible name such as "Insight actions", and visible keyboard focus.
- Everyone signed in sees **Copy link**. When the insight belongs to the logged-in user, append **Edit** and **Delete**, in that order. Separate Delete from the safe actions and use the danger token. The server continues to enforce author-only writes.
- Opening or using the menu must not open the underlying insight row. Support keyboard navigation, Escape, and focus restoration; keep the popup within the viewport and operable inside the detail dialog.
- Copy link copies an absolute shareable insight-detail URL using the supported Browse dialog route. Announce success only after the clipboard write succeeds; if copying fails, show actionable feedback with a selectable link. Shared links retain the existing sign-in requirement.
- Edit opens the shared prefilled form and follows the agreed edit success destination. Delete opens the accessible permanent-delete confirmation; selecting the menu item alone never deletes content.

`components/contribution.tsx` owns the shared responsive create/edit dialog, delete orchestration, and persistent inline success notice. Desktop creation and the mobile floating action open the same form. React Hook Form uses the shared-contract adapters in `lib/contribution-validation.ts`; blank optional title/source fields clear to null. Required categories use the shared `MultiSelection` checkbox group; cities and source URL sit under More details. No selected cities means General. Editing omits `places`, preserving saved associations and ordering without Google requests. `components/ui/textarea.tsx` provides a sufficiently tall, scrollable textarea with resizing disabled.

Creation keeps the originating feed and filters, refreshes results, and announces success with View insight. Editing opens the saved detail view over its list. Deletion uses `components/ui/confirm-dialog.tsx`, identifies the insight and permanent consequence, initially focuses Cancel, retains inline errors for retry, and corrects the refreshed list's pagination. A repeated delete's 404 is reconciled as already removed. There is no Undo for hard deletion.

`components/ui/unsaved-changes.tsx` owns discard confirmation and router/unload guards. Dirty dialogs guard close, outside dismissal, Escape, and navigation; profile fields guard navigation away from the page. Writes disable duplicate submission and keep labels accessible and geometry stable. Failed writes retain in-memory form values. Session loss clears private forms with the existing protected layout; drafts are never persisted. Success and clipboard messages use accessible status regions, while failures remain inline. Clipboard failure includes a selectable absolute link.

`/profile` contains display-name/cohort editing followed by My insights. Email is read-only; an empty cohort clears it. The existing `/api/me` query remains authoritative and successful saves refresh insight author metadata. My insights queries `author=me` across every city and General, newest first, with 20 results per page. Its page and detail UUID live in the URL. `components/insight-list.tsx` shares feed rows and bounded pagination with Browse, and the existing detail dialog retains history, focus, voting, and menu behavior on both pages.

## Do's and Don'ts

- Use semantic links/buttons, visible focus, descriptive names, and sentence case.
- Use the shared Select; do not introduce screen-local dropdowns.
- Preserve browse query parameters on navigation; keep the auth-only `returnTo` parameter out of Browse/home links and protected return destinations. Changing city resets page to 1. URL visits and Back/Forward do not overwrite the stored preference.
- Respect reduced motion and forced colors. Never hide scrollbars.
- Keep future actions disabled and explain why in the preview. Never simulate successful writes.
- No real student content, credentials, API bypass, or Google lookups in fixtures.
- Auth controls say **Sign in**, **Create account**, and **Sign out** consistently. Error color uses `danger`; gold remains the brand accent.
- Preserve safe internal return paths through auth screens. Never put credentials in URLs or use native alert/confirm dialogs.
