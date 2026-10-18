# Public laundry link lookup with a saved worker session

Requested on 2026-10-18: fix the invalid-link error shown when a worker opens today's new route link.

The public lookup used the app's authenticated Supabase client. The deployed restrictive SELECT policy for authenticated users permits Route V2 management only for administrators/managers with site access. An ordinary worker's saved app session therefore hides a link that is readable anonymously. The singular lookup returned PGRST116 and prevented the route PIN screen from loading.

The lookup now uses a separate non-persistent client with the existing publishable key. It does not read, refresh, overwrite or sign out the saved app session. Token, active-state and expiry validation remain; the route PIN, session checks, workflow endpoints and management client are unchanged. Missing links show a useful message. Duplicate rows and backend errors still fail closed.

Scope is the frontend correction specifically requested for public route access. This uses the reviewed release queue because the client session configuration is a protected area. No RLS, grants, SQL, Edge Functions, worker accounts, PINs or operational records are modified; no messages are sent. No automatic-delivery assertion of absent authentication effects is used.

Verification:

- Read-only production inspection: today's three Route V2 links are active and have no expiry. The anonymous role sees three; the authenticated role without management privileges sees zero.
- `node scripts/publicLaundryLinkBrowserTest.mjs`: actual page, hooks and SDK, all network requests intercepted locally. Saved-worker and anonymous scenarios reach the PIN gate; missing, expired, duplicate and network-error scenarios fail closed. Browser storage remains unchanged. No workflow/login writes are requested.
- The browser test fails with the previous shared-client implementation and passes with this change.
- `node scripts/laundryPinAttemptsTest.mjs`: PIN validation, cooldown, IP isolation and worker restrictions pass with local fixtures.
- `npm run build` passes. Root and Node TypeScript checks pass. App TypeScript diagnostics remain identical to the base (102 existing errors). Focused lint diagnostics remain identical (6 existing errors); no new errors.
- Both canonical domains initially served READY deployment `dpl_CbY6RreaDMDSwA6pWLZb5YqMpwhn`. Queue checks must verify base fingerprint and both domains before and after publication.

The reported screenshot does not contain the full token. The exact worker link was requested but was not available during these checks; the reproduced defect and correction are independent of a particular link token. No real token or personal data is stored in this report.
