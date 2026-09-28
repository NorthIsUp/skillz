---
name: rust-project
version: 2.0.0
description: |
  Start a new Rust project from NorthIsUp/template-rust (gh repo create
  --template), then add what a binary needs on top: multi-platform
  release builds with SHA256 checksums and CHANGELOG-driven release
  notes. Use when: "new rust project", "scaffold rust", "create rust
  repo", "rust CI/CD", "release rust binaries".
---

# Rust Project

New Rust projects start from the template; this skill only adds what the template leaves out.

```sh
gh repo create <owner>/<name> --template NorthIsUp/template-rust --public --clone   # or --private
```

Then set `name` and `repository` in `Cargo.toml` and run `mise install` (the `new-project` skill has the full flow).

## What the template already sets up

Don't rebuild any of this by hand:

- `mise.toml`: stable Rust with clippy and rustfmt, hk, pkl, and tasks (`test`, `clippy`, `fmt`, `lint`, `bump-{patch,minor,major}` via `cargo set-version`, which needs `cargo install cargo-edit` once).
- `Cargo.toml`: edition 2024, `unsafe_code = "forbid"`, clippy pedantic + nursery with `unwrap_used` / `expect_used` warned, and a release profile (`lto = "thin"`, `codegen-units = 1`, `strip = "symbols"`).
- `hk.pkl`: rustfmt + clippy on commit, `cargo test` on push.
- `.github/workflows/ci.yml`: fmt, clippy and tests on every push and PR. On `main`, a version bump in `Cargo.toml` tags `v<version>`, publishes to crates.io (`CARGO_REGISTRY_TOKEN` secret; skipped with a warning if unset) and creates a GitHub release.

It's a library crate (`src/lib.rs`). For a binary, add `src/main.rs`.

## Release binaries (add-on)

The template's release job pushes its tag with `GITHUB_TOKEN`, and a tag pushed that way triggers no workflow, so a separate `on: push: tags` release workflow never runs. Add the binary builds as jobs in `ci.yml` after `release` instead.

First expose the tag from the template's `release` job:

```yaml
release:
  outputs:
    tag: ${{ steps.version.outputs.bumped == 'true' && steps.version.outputs.tag || '' }}
```

Then add two jobs. Replace `BINARY_NAME` with the `[[bin]]` name (the package name by default):

```yaml
binaries:
  needs: release
  if: needs.release.outputs.tag != ''
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
    - uses: actions/checkout@v5
    - uses: dtolnay/rust-toolchain@stable
      with:
        targets: ${{ matrix.target }}
    - name: Cross linker
      if: matrix.target == 'aarch64-unknown-linux-gnu'
      run: |
        sudo apt-get update
        # g++ is for crates with C++ deps (e.g. ort).
        sudo apt-get install -y gcc-aarch64-linux-gnu g++-aarch64-linux-gnu
        echo "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc" >> "$GITHUB_ENV"
    - uses: Swatinem/rust-cache@v2
      with:
        key: ${{ matrix.target }}
    - run: cargo build --release --target ${{ matrix.target }}
    - shell: bash
      run: cp "target/${{ matrix.target }}/release/BINARY_NAME${{ runner.os == 'Windows' && '.exe' || '' }}" "${{ matrix.artifact }}"
    - uses: actions/upload-artifact@v6
      with:
        name: ${{ matrix.artifact }}
        path: ${{ matrix.artifact }}

attach-binaries:
  needs: [release, binaries]
  runs-on: ubuntu-latest
  permissions:
    contents: write
  steps:
    - uses: actions/download-artifact@v7
      with:
        merge-multiple: true
    - env:
        GH_TOKEN: ${{ github.token }}
        TAG: ${{ needs.release.outputs.tag }}
      run: |
        sha256sum BINARY_NAME-* > checksums-sha256.txt
        gh release upload "$TAG" BINARY_NAME-* checksums-sha256.txt -R "$GITHUB_REPOSITORY"
```

Named binaries (`name-arch-os`), not archives: one download, no unpacking. Per-target cache keys keep the targets' caches apart.

Platform caveats:

- `ort` (ONNX Runtime) ships no prebuilt Intel-Mac binaries: drop `x86_64-apple-darwin`; Intel users run the arm64 build under Rosetta.
- Other native deps fail the first release loudly with "no prebuilt binaries for target X". Drop that target.

## CHANGELOG release notes (add-on)

Keep a `CHANGELOG.md` in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format (`## [Unreleased]`, then `## [X.Y.Z] - YYYY-MM-DD` sections of `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`). To lead the release body with the version's section, replace the `run:` of the template's "Create GitHub Release" step:

```yaml
run: |
  version="${TAG#v}"
  awk -v v="$version" '$0 ~ "^## \\[" v "\\]" { f=1; next } f && /^## \[/ { exit } f' CHANGELOG.md > notes.md
  gh release create "$TAG" --title "$TAG" --notes-file notes.md --generate-notes
```

`--generate-notes` appends the PR notes below the file's contents; with no section for the version, `notes.md` is empty and the release carries only the generated notes.

## Releasing

1. Move `[Unreleased]` items into a new `## [X.Y.Z] - YYYY-MM-DD` section.
2. `mise run bump-patch` (or `-minor`, `-major`).
3. `git add CHANGELOG.md Cargo.toml Cargo.lock && git commit -m "release X.Y.Z" && git push`.

CI tags, publishes to crates.io, creates the release, then attaches the binaries and `checksums-sha256.txt`. Commit `Cargo.lock` for binaries.
