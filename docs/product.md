# Product Summary - Minerva Atlas

## Summary
Minerva Atlas is a knowledge-sharing platform for Minerva University students.

It helps current and incoming students discover practical, Minerva-specific information about rotation cities by bringing together:

- student experiences and recommendations;
- structured information about places and cities.

## Problem
Minerva University students rotate around the world each semester. Thus, students need information and insights when moving to new rotation cities and navigating their new lives for 4 months to a year. 

Currently, knowledge are scattered across many platforms.
- Official information in my.minerva.edu, Student Handbook, etc.
- Student-generated knowledge (insights, tips), which can be difficult to retain because it's buried in messages or disappear between cohorts.

Target users: current and incoming Minerva students, and alumni

# Scope

## In scope
- Email and password sign-up and sign-in through Better Auth, limited to `minerva.edu` and `uni.minerva.edu` addresses and enforced on the server. All content requires sign-in.
- City selection, including a **General** option for insights with no city.
- Browsing, keyword search, and category filtering.
- Creating, editing, and deleting your own insights.
- Upvoting insights. There are no downvotes.
- Optionally tagging Google Maps places on an insight.
- **Agent** and **Discover** nav items that link to empty placeholders until those features are built.

## Later iterations
- Google sign-in
- 2-step verification for `uni.minerva.edu` accounts that use email and password
- Password reset
- Media uploads
- Comments
- Interactive map and custom map pins
- Official vs. student content labels
- AI features

# Core user flows

1. Sign up or sign in: enter an email and password -> sign-up is rejected unless the email uses an allowed university domain
2. Discover: select a city or General -> browse, search, or filter by category -> open an insight
3. Contribute: create an insight with body text and one or more categories
   - The currently selected city is prefilled and can be changed to several cities or none.
   - Title, source URL, and places are optional.
   - Authors can edit their own insights and permanently delete them.
4. Interact: open an insight -> upvote it, or remove the upvote

# Browsing and ownership rules
- An insight appears in the feed of every city it belongs to.
- An insight with no city appears only under General.
- An insight appears under every category it belongs to.
- Search includes the selected city's insights plus insights with no city.
- Deleting is a hard delete.
- Authors manage only their own insights. There is no admin role or UI; removal requests are handled directly in the database.

See [schema.md](schema.md) for the data schema.
