# @ak5/shared

Core cross-package contracts and pure utilities: cookie origin parsing, JWT
sign/verify, pagination, public-id generation, generic constants, string/format
helpers, and country/language lists. No framework, no DB, no I/O — just types and
pure functions usable from the API worker, the CLI, and (via `@ak5/webui`) the
frontends.

Built to `dist/` with `tsc`. Frontend runtime code should reach this behavior
through `@ak5/webui`, not by importing `@ak5/shared` directly.
