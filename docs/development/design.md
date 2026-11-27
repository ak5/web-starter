# Portal design

The customer portal makes the next action easy to find. Use comfortable spacing,
clear labels, and focused page widths. The admin portal prioritizes the state of
the system and puts actions alongside the data they affect. The Users page
shows the pattern with wide, compact tables and an invitation dialog.

Both portals import [tokens.css](../../packages/webui/src/tokens.css) and
[controls.css](../../packages/webui/src/controls.css). Change the light and dark
values of `--accent` and `--on-accent` to brand a project. Check text contrast,
hover, and focus in both themes. Use semantic Tailwind utilities such as
`bg-surface` and `text-ink`, and reuse the existing control classes before
adding a new variant. MCP consent uses the same token file.

The theme cookie saves System, Light, or Dark independently of density.
Signed-in admin uses compact density. Customer pages, sign-in, and dialogs use
comfortable density. Keep labels readable, keyboard focus visible, and touch
targets generous. Let wide tables scroll inside their containers.
