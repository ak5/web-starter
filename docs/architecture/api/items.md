# API — items (example resource)

A deliberately generic CRUD resource that exists to demonstrate the end-to-end
shape: a router, a lib, validation, and a typed client — driven by the native mobile
app (`packages/mobile`). **It is a demo. Replace it with your real domain.** Nothing
in the identity spine depends on it; deleting it is mechanical (see below).

- Router: `packages/api/src/routes/items.ts`
- Logic: `packages/api/src/lib/items.ts` (+ `items-validation.ts`)
- Table: `items` (see [../database.md](../database.md))
- Scope: mounted on `webApi` only, gated by `requireAuth('user')`.

## Shape

Every row is owned by a user and carries a free-form `data` JSON object the API
stores verbatim (`jsonb`) — it does not constrain `data`'s shape. Clients only
ever see the public id (`i-…`), never the internal PK or `user_id`.

```jsonc
{
	"id": "i-9f3k2m1a0b", // public id
	"data": { "text": "hello" }, // arbitrary JSON
	"createdAt": "2026-06-19T12:00:00.000Z",
	"modifiedAt": "2026-06-19T12:30:00.000Z"
}
```

## Endpoints

All require a valid user JWT cookie; all are scoped to the caller (you can only
read/modify your own items). Unknown or other-user ids return `404`.

| Method + path       | Body       | Returns                                      |
| ------------------- | ---------- | -------------------------------------------- |
| `GET /items`        | —          | `{ items: Item[], pagination }`              |
| `GET /items/:id`    | —          | `Item`                                       |
| `POST /items`       | `{ data }` | `Item` (201)                                 |
| `PATCH /items/:id`  | `{ data }` | `Item` (replaces `data`, bumps `modifiedAt`) |
| `DELETE /items/:id` | —          | `{ ok: true }`                               |

`GET /items` is paginated with the repo-wide convention: `?page=` is 0-indexed,
page size is `PAGE_SIZE` (`@ak5/shared`), and the response carries a
`pagination` meta object (`total`, `page`, `totalPages`, `hasNext`, `hasPrev`).

## Removing it

Delete `routes/items.ts`, `lib/items.ts`, `lib/items-validation.ts`, the two
`/items` mounts in `app.ts`, the `items` table + relation + `Item` type in
`db/schema.ts`, and the `item` prefix in `@ak5/shared`'s `public-id.ts`. Then
regenerate a migration. On the client, remove `packages/mobile`'s items feature.
