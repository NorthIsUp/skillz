---
name: rust-project
version: 1.0.0
description: |
  Scaffold a new Rust project with CI and release workflows. Creates Cargo workspace,
  GitHub Actions for CI (test + clippy + fmt) and multi-platform release builds with
  SHA256 checksums. Follows the northisup/agentic.md pattern.
  Use when: "new rust project", "scaffold rust", "create rust repo", "rust CI/CD".
---

# Rust Project Scaffold

Create new Rust projects with production-ready CI and cross-platform release pipelines.

## When to Use

- Creating a new Rust binary or library
- Setting up CI/CD for an existing Rust project
- Adding release automation to a Rust repo

## Project Structure

```
project-name/
├── .github/
│   └── workflows/
│       ├── ci.yml          # test + clippy + fmt on push/PR
│       └── release.yml     # multi-platform builds on v* tags
├── .gitignore              # /target
├── Cargo.toml
├── Cargo.lock              # always commit for binaries
└── src/
    └── main.rs             # or lib.rs
```

## CI Workflow (ci.yml)

Runs on every push to main and every PR. Three checks, in this order:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
      - run: cargo test
      - run: cargo clippy -- -D warnings
      - run: cargo fmt --check
```

Key decisions:
- `dtolnay/rust-toolchain@stable` — no version pinning, always latest stable
- `Swatinem/rust-cache@v2` — caches cargo registry + build artifacts
- Test → clippy → fmt order (fail fast on logic errors before style)

## CHANGELOG.md

Keep a Changelog format, committed to repo root. The release workflow reads
the section for the tagged version and uses it as the release body.

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - YYYY-MM-DD

### Added

- Initial release.
```

Section types (Keep a Changelog): `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

**Before tagging a release:**
1. Move items from `[Unreleased]` into a new `[X.Y.Z] - YYYY-MM-DD` section
2. Commit with a message like "chore: prepare vX.Y.Z"
3. Tag and push: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`

## Release Workflow (release.yml)

Triggers on `v*` tags. Builds 5 targets, creates checksums, extracts the
matching CHANGELOG.md section, publishes a GitHub release.

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - target: x86_64-unknown-linux-gnu
            os: ubuntu-latest
            artifact: BINARY_NAME-x86_64-linux
          - target: aarch64-unknown-linux-gnu
            os: ubuntu-latest
            artifact: BINARY_NAME-aarch64-linux
          - target: x86_64-apple-darwin
            os: macos-latest
            artifact: BINARY_NAME-x86_64-darwin
          - target: aarch64-apple-darwin
            os: macos-latest
            artifact: BINARY_NAME-aarch64-darwin
          - target: x86_64-pc-windows-msvc
            os: windows-latest
            artifact: BINARY_NAME-x86_64-windows.exe

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install cross-compilation tools
        if: matrix.target == 'aarch64-unknown-linux-gnu'
        run: |
          sudo apt-get update
          # g++-aarch64-linux-gnu is needed for crates with C++ deps (e.g. ort).
          sudo apt-get install -y gcc-aarch64-linux-gnu g++-aarch64-linux-gnu
          echo "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc" >> $GITHUB_ENV

      - uses: Swatinem/rust-cache@v2
        with:
          key: ${{ matrix.target }}

      - name: Build
        run: cargo build --release --target ${{ matrix.target }}

      - name: Rename binary (unix)
        if: runner.os != 'Windows'
        run: cp target/${{ matrix.target }}/release/BINARY_NAME ${{ matrix.artifact }}

      - name: Rename binary (windows)
        if: runner.os == 'Windows'
        run: cp target/${{ matrix.target }}/release/BINARY_NAME.exe ${{ matrix.artifact }}

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: ${{ matrix.artifact }}

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      - name: Create checksums
        run: |
          cd artifacts
          sha256sum BINARY_NAME-* > checksums-sha256.txt

      - name: Extract changelog section
        id: changelog
        run: |
          version="${GITHUB_REF#refs/tags/v}"
          # Extract the [version] section from CHANGELOG.md (stops at next ## heading).
          notes=$(awk -v v="$version" '
            $0 ~ "^## \\[" v "\\]" { flag=1; next }
            flag && /^## \[/ { exit }
            flag { print }
          ' CHANGELOG.md)
          if [ -z "$notes" ]; then
            echo "No changelog entry found for v${version}; using auto-generated notes only."
            echo "has_notes=false" >> $GITHUB_OUTPUT
          else
            {
              echo 'notes<<CHANGELOG_EOF'
              echo "$notes"
              echo 'CHANGELOG_EOF'
            } >> $GITHUB_OUTPUT
            echo "has_notes=true" >> $GITHUB_OUTPUT
          fi

      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          body: ${{ steps.changelog.outputs.has_notes == 'true' && steps.changelog.outputs.notes || '' }}
          generate_release_notes: true
          files: |
            artifacts/BINARY_NAME-*
            artifacts/checksums-sha256.txt
```

**Replace `BINARY_NAME` with the actual binary name** (the `[[bin]] name` from Cargo.toml).

Key decisions:
- Named binaries (`name-arch-os`) not tar.gz archives — simpler to download and use
- SHA256 checksums for verification
- `softprops/action-gh-release@v2` — cleaner than `gh release create`
- `generate_release_notes: true` — appends PR-based auto-notes below the CHANGELOG body
- The release job checks out the repo so it can read CHANGELOG.md
- `awk` extracts the matching `## [X.Y.Z]` block and passes it to `body:`
- If no CHANGELOG entry exists for the tag, the release still works (auto-notes only)
- Cross-compilation for aarch64-linux via `gcc-aarch64-linux-gnu`
- Per-target cache keys to avoid cache collisions

**Platform caveats:**
- If your project depends on `ort` (ONNX Runtime bindings), drop `x86_64-apple-darwin` from the matrix — `ort` doesn't ship prebuilt binaries for Intel Macs. `aarch64-apple-darwin` covers modern Macs; Intel users can use Rosetta.
- Other native-deps may have similar constraints. First release will fail loudly with "no prebuilt binaries for target X" — drop that target from the matrix.

## Cargo.toml Conventions

```toml
[package]
name = "project-name"
version = "0.1.0"
edition = "2021"
rust-version = "1.80"
description = "One-line description"
license = "MIT"
repository = "https://github.com/org/repo"

[profile.release]
lto = "thin"
codegen-units = 1
strip = true
```

Release profile: `lto = "thin"` for link-time optimization without extreme build times,
`codegen-units = 1` for better optimization, `strip = true` for smaller binaries.

## Releasing

```bash
# 1. Move CHANGELOG [Unreleased] items into a new [X.Y.Z] - YYYY-MM-DD section
# 2. Bump version in Cargo.toml
# 3. Commit:
git add CHANGELOG.md Cargo.toml Cargo.lock
git commit -m "chore: prepare vX.Y.Z"
# 4. Tag and push:
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main vX.Y.Z
```

The release workflow builds all 5 targets and publishes a GitHub release with:
- Named binaries per target (`BINARY_NAME-x86_64-linux`, etc.)
- `checksums-sha256.txt` with SHA256 hashes
- Release body = `## [X.Y.Z]` section from CHANGELOG.md + auto-generated PR notes appended

## .gitignore

```
/target
```

That's it. Commit `Cargo.lock` for binaries (deterministic builds).

## Checklist

When scaffolding a new Rust project:

1. `cargo new project-name` (or `cargo new --lib project-name`)
2. Set edition, rust-version, license, repository in Cargo.toml
3. Add release profile to Cargo.toml
4. Create `CHANGELOG.md` from template above with `[Unreleased]` and `[0.1.0]` sections
5. Create `.github/workflows/ci.yml` from template above
6. Create `.github/workflows/release.yml` — replace BINARY_NAME (3 places)
7. Create `.gitignore` with `/target`
8. Create repo on GitHub: `gh repo create org/project-name --public --description "..." --license MIT`
9. Push, verify CI passes (fmt + clippy + test)
10. Tag v0.1.0, verify release workflow produces artifacts and release body contains the CHANGELOG section
