# pixel-marketplace

## Cursor Cloud specific instructions

This repository is currently a placeholder. As of this writing it contains only
`README.md` (headings `sandbox-test` / `pixel-marketplace`) and no application
code, dependency manifest, tests, lint config, or build system. There is nothing
to install, run, lint, test, or build yet.

The base Cloud Agent VM already provides common toolchains, so no extra system
setup is needed to begin development here: Node 22 (`npm`, `pnpm`), Python 3.12,
Go 1.22, Rust 1.83, JDK 21, and Docker.

The startup update script is intentionally minimal and guarded: it only installs
dependencies when a recognized manifest exists (`pnpm-lock.yaml`, `yarn.lock`,
`package-lock.json`, `package.json`, or `requirements.txt`). Once real
application code and a dependency manifest land, revisit this file and the update
script to document the actual dev/lint/test/build/run commands for the service(s).
