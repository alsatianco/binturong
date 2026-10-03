# Working agreements

- After every meaningful change, make a commit with a concise, one-line message.
- Do not run git push unless the user explicitly asks for it.

## Documentation

- [README.md](README.md) is the user entry point and owns development, testing, and build commands. [how_to_use.md](how_to_use.md) owns detailed user workflows and examples.
- AGENTS.md holds contributor rules and pointers. Deeper guides and validation evidence are indexed in [docs/README.md](docs/README.md). Keep distribution instructions beside [packaging assets](packaging/README.md).
- Changes to behavior, commands, configuration, or builds update the owning documentation in the same commit.
- Link changing inventories and version sources; verify user examples against the implementation, including each interface's dispatcher and controls.
- Preserve dated evidence and design rationale separately from current instructions, and keep retained documents reachable from a hub.
