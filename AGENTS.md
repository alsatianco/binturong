# Working agreements

- After every meaningful change, make a commit with a concise, one-line message.
- When a commit fully fixes a GitHub issue, include `Fixes #<issue-number>` in its message (for example, `Fix pipeline selector theme (Fixes #1)`) so GitHub closes the issue when the commit reaches the default branch. For multiple resolved issues, include a closing reference for each; for partial fixes, use `Refs #<issue-number>` instead.
- Do not run git push unless the user explicitly asks for it.

## Documentation

- [README.md](README.md) is the user entry point and owns development, testing, and build commands. [how_to_use.md](how_to_use.md) owns detailed user workflows and examples.
- AGENTS.md holds contributor rules and pointers. Deeper guides and validation evidence are indexed in [docs/README.md](docs/README.md). Keep distribution instructions beside [packaging assets](packaging/README.md).
- Changes to behavior, commands, configuration, or builds update the owning documentation in the same commit.
- Link changing inventories and version sources; verify user examples against the implementation, including each interface's dispatcher and controls.
- Preserve dated evidence and design rationale separately from current instructions, and keep retained documents reachable from a hub.
