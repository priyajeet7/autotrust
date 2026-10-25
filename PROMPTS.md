# AI Prompts

Raw prompts I sent to AI tools while building AutoTrust, copied verbatim (typos included). Nothing
here is an AI-written summary.

---

## Earlier sessions: repository scaffold, env validation, test-DB guard, health endpoint

_Commits `914d6a8`…`41de392`, plus the Prisma setup committed in `d0ad130`._

<!-- TODO (Priyajeet): paste the raw prompts / chat log from these earlier Claude sessions here,
     or add public share links to those chats. -->

---

## Session: feature implementation (Claude Code, Claude Opus 5.5, 2026-10-25)

_Commits `d0ad130` onward._

### Prompt 1

```
Work autonomously to complete my existing AutoTrust Car Dealership Inventory System assessment in this repository. My deadline is close, so prioritize a working, tested submission over optional features.

First inspect the existing files, Git history, working-tree changes, tests, and installed packages. Preserve all existing work; do not recreate the repository or discard changes.

Required stack: Node.js 22+, TypeScript, Express, PostgreSQL, Prisma 7.10.1, React, and Tailwind CSS. PostgreSQL 18.6 is installed locally on Windows. The `autotrust` and `autotrust_test` databases and the `autotrust` database role already exist. Docker is unavailable.

Complete all required features:
- Prisma User, Vehicle, and Purchase models and a working migration.
- Registration and login with secure password hashing and JWT.
- Protected vehicle creation, listing, searching by make/model/category/price, updating and admin-only deletion.
- Protected purchase and admin-only restocking, with validation, safe database transactions, and correct stock quantities.
- Responsive React/Tailwind UI with login/register, inventory dashboard, search, purchase buttons disabled for zero stock, and admin controls.
- Meaningful automated tests, following genuine test-first Red-Green-Refactor steps for new work.
- Root README with setup instructions, screenshots from the real running app, actual test report, and a truthful "My AI Usage" section.
- Root PROMPTS.md containing raw AI prompts/chat logs or public chat links, not AI-generated summaries.

Use the existing architecture where possible. Inspect before changing. Implement incrementally, run the real tests/typecheck/build, fix failures, and continue without waiting for confirmation on routine non-destructive coding tasks. Ask before destructive actions, deleting existing work, exposing secrets, or publishing anything.

Use my Git author identity if commits are needed: Priyajeet Singh <priyanshusingh2300@gmail.com>. Every AI-assisted commit must have a truthful Co-authored-by trailer for Claude. Do not fabricate historical TDD commits, test results, screenshots, deployment, or features.

Start by inspecting the repo, then implement the highest-priority missing requirements and continue until the required scope is complete. At the end, report what works, commands actually tested, remaining issues, and exact submission steps.
```

### Prompt 2 (after the connection dropped mid-session)

```
restart where u resume before connection lost
```

### Prompt 3

Claude had asked me to run, as the `postgres` superuser,
`ALTER DATABASE autotrust OWNER TO autotrust;` because migrations to the dev database failed with
`permission denied for schema public`. I ran it myself and replied:

```
succeds
```
