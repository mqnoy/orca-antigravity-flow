# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-11-24

### Added

- Sprint deletion in both the **Agile Board** and **Roadmap & Sprints** tabs with inline confirmation, allowing users to move a sprint's work items and epic `targetSprintId` links to another sprint or delete them with the sprint (`board.deleteSprint`, documented in `README.md`).
- Cover image banner (`assets/cover.png`) in `README.md`.

### Fixed

- Omitted `undefined` fields from JSON IPC payloads (workflow execution and saving, work-item creation and summoning, and sprint/epic saving) and worker activity/usage records so requests pass Orca's strict JSON schema validation.
- Clamped terminal titles to Orca's 512-character limit across direct summons, Google sign-in, workflow steps, and Agile task launches.
- Prevented default starter sprints from re-seeding automatically after all sprints are deleted.
- Made `workspaceId` optional in `workflows.execute` to match automatic active-workspace resolution, validated `workflowId`, and synchronized panel sprint selection and confirmation state whenever sprints change or are deleted.

## [1.0.1] - 2026-11-23

### Changed

- Bumped the `orca-plugin.json` manifest version from `1.0.0` to `1.0.1` with no code, documentation, or asset changes.

## [1.0.0] - 2026-11-23

Initial release of Antigravity Flow, an Orca sidebar plugin for Agile sprint planning, multi-agent startup workflows, isolated Antigravity CLI accounts, and live token quota monitoring.

### Added

- **Orca plugin and sidebar panel**: Manifest v2 `trusted-worker` plugin (`antigravity-flow`, Orca `>=1.4.248`, MIT) contributing the right-sidebar **Antigravity Flow** panel (*Agile Board*, *Roadmap & Sprints*, *Startup Workflows*, *Accounts & Personas*, and *Usage & Quota* tabs), the `Antigravity: Open Antigravity Flow` command (`antigravity.openFlow`), live `workspace.changed` tracking, and `accountsBaseDir` and `agyCommand` settings.
- **Agile Board and Workspace Board integration**: Four Kanban lanes synced 1:1 with Orca (`Todo`, `In Progress`, `In Review`, and `Done`), lane filters, one-click lane transitions, work-item CRUD with story points and assignments, a one-click native **Workspace Board** launcher, and **Run with Agent** to launch `agy` with sprint, epic, and persona markdown context while moving `todo` items to `in-progress`.
- **Roadmap and Sprints lifecycle**: Strategic Epics CRUD with story-point velocity progress bars, sprint creation with goals, dates, and target points, **Complete Sprint** with unfinished-task rollover, and pre-seeded starter sprints, epics, and work items.
- **Multi-agent startup workflows**: Built-in pipelines (*Agile Sprint: Feature Epic Delivery*, *Agile Hotfix: Rapid Bugfix & Patch*, and *Agile Spike: Architecture & Tech Evaluation*) plus custom multi-step workflow creation, deletion, and execution.
- **Isolated accounts, personas, and CLI summoning**: Per-account isolated `HOME` and `GEMINI_HOME` directories (`~/.gemini-accounts/<id>/`), headless OAuth fallback flags, an interactive Google sign-in terminal, direct `agy` summoning with markdown prompts, dynamic CLI flags (`--dangerously-skip-permissions` toggle and custom flags), optional non-destructive symlinking of host global skills, and five pre-seeded plus custom personas synced to `AGENTS.md` and `PERSONA.md`.
- **Live token quota and feature usage monitoring**: Zero-cost quota checks via `agy -p /usage --output-format json` covering 5-hour and weekly limits across Gemini and Claude/GPT buckets with color-coded badges and auth/email auto-detection, per-account and team usage analytics (summons, workflow steps, completed tasks and story points, symlink-excluded disk usage, and session counts), a chronological activity stream, and history reset.

[Unreleased]: https://github.com/mqnoy/orca-antigravity-flow/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/mqnoy/orca-antigravity-flow/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/mqnoy/orca-antigravity-flow/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/mqnoy/orca-antigravity-flow/releases/tag/v1.0.0
