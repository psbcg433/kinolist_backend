# KinoList Postman workspace

Import these two files into Postman:

1. `KinoList.postman_collection.json`
2. `KinoList.local.postman_environment.json`

Select **KinoList Local (Gateway)** as the active environment. All requests use
`{{gatewayUrl}}`, which defaults to `http://localhost:5000`. No request calls an
individual service URL.

The collection asserts the standard response contract on every request:
success bodies contain only `success`, `data`, `meta`, and `requestId`; errors
contain only `success`, `error`, and `requestId`.

## Suggested order

1. Start the stack with `docker compose up --build`.
2. Run **Gateway & Health / Gateway readiness**.
3. Change `email` if the default test account already exists.
4. Run **Auth / Register**, then **Auth / Login**. Registration intentionally
   creates no session and issues no credentials.
5. Run protected Profile, Library, Movie, Feed, and Recommendation requests.
6. Run **Delete account (destructive)** only when cleanup is intended.

Postman keeps the refresh cookie in its cookie jar. Collection scripts also
capture `accessToken`, `csrfToken`, `userId`, `challengeId`, and
the IDs returned by playlist/session requests for later requests.

For email 2FA, run **Begin 2FA setup**. The API returns only a `challengeId`
and masked delivery address; it never returns the QR or code. In local Docker,
open Mailpit at `http://localhost:8025`, scan the embedded PNG QR, place its
six-digit value in `twoFactorCode`, and run **Verify 2FA setup**. Later password
logins send a new single-use QR and issue no access, refresh, or CSRF token
until **Verify 2FA login** succeeds.

The optional profile image form-data fields are disabled by default. Enable
them in Postman and select local files when testing uploads. Postman may not
automatically resolve environment-variable file paths on every desktop version.

## Scope

The collection contains every route exposed through the API gateway. The
`/internal/movie/*` and `/internal/library/*` service-to-service endpoints are
intentionally excluded: they require `X-Internal-Key` and are not routed by the
gateway.
