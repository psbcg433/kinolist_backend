# KinoList Microservices

Backend rebuild of the legacy CineAI MERN app as a set of independently
deployable Node/Express microservices. Each service owns its own Mongo
database and communicates with peers strictly over internal HTTP (guarded by
`INTERNAL_API_KEY`) or via Redis Streams domain events.

> Backend only. The legacy frontend API contracts are kept compatible where
> practical, but no code from the legacy repo is copied in.

## Services

| Service          | Port | Mongo db            | Owns                                                        |
| ---------------- | ---- | ------------------- | ----------------------------------------------------------- |
| `api-gateway`    | 5000 | –                   | Edge concerns only (CORS, rate limit, body limit, proxy)    |
| `auth-service`   | 5001 | `kinolist_auth`     | Credentials, sessions, refresh-token hashes, 2FA, tokenVersion |
| `profile-service`| 5002 | `kinolist_profile`  | Name, bio, profilePic, coverPic (Cloudinary)                |
| `library-service`| 5003 | `kinolist_library`  | Playlists (favourites/watchlist/custom) with movie snapshots |
| `movie-service`  | 5004 | `kinolist_movie`    | OMDb metadata + cache                                       |
| `discovery-service`| 5005 | `kinolist_discovery`| Search history, feeds, AI search, recommendations           |

Internal DNS on the Docker network is `http://<service-name>:<port>`; only the
gateway (5000) is exposed to the host.

## Quick start

```bash
cp .env.example .env            # fill in secrets (see below)
node scripts/generate-jwt-keys.mjs   # RS256 key pair → copy into .env
docker compose up --build
```

The API is then available at `http://localhost:5000/api`.

### Generating the JWT keys

`scripts/generate-jwt-keys.mjs` prints an `JWT_ACCESS_PRIVATE_KEY` and
`JWT_ACCESS_PUBLIC_KEY` you paste into `.env`. The private key stays with
`auth-service` (signing); all other services only need the public key. An
HS256 fallback exists: set `JWT_ALGORITHM=HS256` and `JWT_ACCESS_SECRET`
instead.

## Required environment

See `.env.example` for the full list. At minimum:

- `JWT_ALGORITHM` (+ RS256 keys or HS256 secret), `JWT_ISSUER`, `JWT_AUDIENCE`
- `CSRF_SECRET`, `TOTP_ENCRYPTION_KEY` (auth-only, 32-byte keys for the 2FA secret)
- `INTERNAL_API_KEY` (shared, trusted internal HTTP)
- `OMDB_API_KEY`, `OPENROUTER_API_KEY`, `TASTEDIVE_API_KEY`,
  `CLOUDINARY_CLOUD_NAME`/`API_KEY`/`API_SECRET`
- `COOKIE_SECURE=false` for local HTTP, `true` behind TLS
- `FRONTEND_ORIGINS` for gateway CORS

## Tests

```bash
docker compose run --rm gateway    npm test   # or, per service:
for s in services/*; do (cd "$s" && npm test) done
```

All six services pass their suites (37 tests total). Auth and gateway run
`node --test` directly; profile/library/movie/discovery run
`node --import ./tests/env-setup.mjs` over each test file (they are
integration tests against ephemeral Mongo/Redis).

## Documentation

- [Architecture](docs/architecture.md) — layering, data ownership, auth flow, namespaces
- [API reference](docs/api.md) — public + internal routes and DTO shapes
- [Events](docs/events.md) — Redis Streams event schema and consumers

## Repository layout

```
.
├── docker-compose.yml
├── .env.example
├── scripts/generate-jwt-keys.mjs
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── profile-service/
│   ├── library-service/
│   ├── movie-service/
│   └── discovery-service/
└── docs/
```
