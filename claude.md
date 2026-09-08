# CLAUDE.md

Project instructions and behavioral guidelines for AI coding assistants working on the QPilot Workspace.

---

# 1. Behavioral Guidelines

These guidelines are intended to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

* State assumptions explicitly when they materially affect the implementation.
* If multiple interpretations exist, present them rather than choosing silently.
* If a simpler approach exists, say so.
* Push back when the requested approach introduces unnecessary complexity.
* If something is unclear or contradictory, stop and identify what is unclear before implementing.
* Do not invent requirements that were not provided.

## 1.2 Simplicity First

**Use the minimum code that solves the problem. Nothing speculative.**

* Do not implement features beyond what was requested.
* Do not create abstractions for single-use code.
* Do not add flexibility or configurability that was not requested.
* Do not add error handling for genuinely impossible scenarios.
* Prefer existing utilities, components, hooks, and patterns when they already solve the problem.
* Avoid unnecessary dependencies.
* Avoid premature optimization.
* Avoid over-engineering.

## 1.3 Surgical Changes

**Touch only what you must. Clean up only your own mess.**

* Do not improve adjacent code, comments, or formatting unless required.
* Do not refactor code that is unrelated to the requested change.
* Match the existing project style.
* Preserve existing behavior unless the request explicitly changes it.
* Do not rename unrelated variables, functions, components, or files.
* Do not reorganize unrelated code.

---

# 2. Design System Reference

When implementing UI components or layout changes, always refer to the specifications in **`DESIGN_SYSTEM.md`**.