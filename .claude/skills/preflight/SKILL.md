---
name: preflight
description: Runs tests, performs a multi-agent code review, and opens a PR if everything passes.
allowed-tools:
  - Bash(*)
  - Read
---

# Phase 1: Quality Gates (The "No-Fail" Protocol)
1. **Lint & Test**: Run the project's test suite (e.g., `npm test`, `pytest`, or `go test`).
   - *If tests fail, STOP and show the errors. Do not proceed to PR.*
2. **Type Check**: Ensure there are no TypeScript/Type errors (e.g., `npm run check`).

# Phase 2: The "Triple Check" Review
1. **Self-Review**: Analyze the `git diff main...HEAD`. Check for:
   - Debugging logs (`console.log`, `print`) accidentally left in.
   - Hardcoded secrets or keys.
   - Documentation updates needed in `README.md`.
2. **Style Check**: Verify compliance with the rules in `@CLAUDE.md`.

# Phase 3: The PR Launch
1. **Template**: Read `@.github/PULL_REQUEST_TEMPLATE.md`.
2. **Draft**: Create a comprehensive PR body including a "Verification" section detailing the tests that just passed in Phase 1.
3. **Execute**:
   `! gh pr create --fill --body-file -`
   *(The --fill flag automatically uses commit titles if you haven't provided a title).*

# Constraints
- If any command in Phase 1 returns a non-zero exit code, you must ask the user for permission before trying to fix or proceed.
- Be extremely critical of the code in Phase 2. If it's messy, suggest a refactor before the PR.