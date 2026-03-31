# Branch Protection Rules for `main`

Configure these in **GitHub → Settings → Branches → Add rule** for the pattern `main`.

## Required settings

| Setting | Value |
|---------|-------|
| Require a pull request before merging | ✅ Enabled |
| — Required approvals | 1 (raise to 2 before production launch) |
| — Dismiss stale reviews on new commits | ✅ Enabled |
| — Require review from Code Owners | ✅ Enabled (once CODEOWNERS added) |
| Require status checks to pass | ✅ Enabled |
| — Status checks required | `ESLint`, `Prettier`, `API Tests`, `Web Build`, `npm audit` |
| — Require branches to be up to date | ✅ Enabled |
| Require conversation resolution | ✅ Enabled |
| Do not allow bypassing the above settings | ✅ Enabled (blocks admins too) |
| Restrict who can push to matching branches | ✅ Enabled — only CI service account |
| Allow force pushes | ❌ Disabled |
| Allow deletions | ❌ Disabled |

## GitHub Environments (for deploy approval gates)

Create two environments in **Settings → Environments**:

### `staging`
- No approval required — auto-deploys on merge to main
- Add environment-specific secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### `production`
- **Required reviewers:** add at least one maintainer
- **Wait timer:** 5 minutes (gives time to catch issues in staging)
- Add environment-specific secrets: `AWS_ACCESS_KEY_ID_PROD`, `AWS_SECRET_ACCESS_KEY_PROD`

## Why these rules

Direct pushes to `main` have caused two incidents in similar projects:
- Unreviewed code reaching production
- Broken builds shipped because CI was skipped

These rules ensure every change is peer-reviewed and all CI checks pass before merge.
