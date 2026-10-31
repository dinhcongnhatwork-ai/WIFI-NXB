# Implementation ledger — docs/builder-screens-implementation.md

Branch: feat/builder-screens-attendance. Baseline: 50 passing, 1 skipped.

Ruling: Use current checkout and a feature branch because the user explicitly
requested implementation in the IDE workspace; preserve the user's uncommitted API change.

Interface review:
| Tasks | Shared interface | Decision |
|---|---|---|
| 1 / 3 / 4 | Screen document | Root owns template-document.ts; consumers use documented exports. |
| 2 / 3 | Portal attendance | Backend returns attendanceSession, isAlreadyRegistered and portalSessionId. |
| 1 / 4 | Media library | URL stays callback argument 1 for compatibility. |
| 2 / 4 | Template create/delete | Existing authenticated APIs remain; backend owns delete protection. |

Task 1: in progress.
Task 2: pending delegation.
Task 3: pending.
Task 4: pending.
Task 5: pending.
