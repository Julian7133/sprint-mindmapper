# AuraMindmap release — macOS signing, notarization, DMG

This folder holds the scaffolding to build a **signed + notarized** `.app` and
`.dmg` for macOS. No secrets or fake credentials are committed — everything is
env-driven.

## Prerequisites

- Rust toolchain + Xcode Command Line Tools (`cargo`, `clang`).
- An Apple Developer account with a **Developer ID Application** certificate
  installed in the login keychain.
- An app-specific password from https://appleid.apple.com.

## Workflow

1. Install deps + sanity check:

   ```sh
   npm install
   npm run build
   npm test
   ```

2. Export signing/notarization env (copy `.env.example` → `.release-env` and
   fill in, or export in your shell):

   ```sh
   set -a; source release/.release-env; set +a
   ```

3. Build the `.app` + `.dmg` (ad-hoc if `APPLE_SIGNING_IDENTITY` unset, or
   signed with the Developer ID if set):

   ```sh
   ./release/release.sh                 # host arch
   ./release/release.sh universal-apple-darwin   # universal binary
   ```

4. Notarize + staple the DMG:

   ```sh
   ./release/notarize.sh
   ```

## Env vars (see `.env.example`)

| Var                    | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `APPLE_ID`             | Apple account email                                |
| `APPLE_TEAM_ID`        | Team ID (part of the Developer ID string)          |
| `APPLE_PASSWORD`       | App-specific password (not the login password)     |
| `APPLE_SIGNING_IDENTITY` | Optional Developer ID Application signing identity |
| `TARGET`               | Optional rust target (e.g. `universal-apple-darwin`) |

## What the scripts do

- `release.sh` runs `npm run build` (frontend staging + bundling), then
  `tauri build --bundles app,dmg`. If `APPLE_SIGNING_IDENTITY` is set it is
  injected into the bundle via a temporary Tauri config override. It does not
  call the notary service.
- `notarize.sh` submits the DMG to `xcrun notarytool`, staples the ticket, and
  validates it.

## Notes

- Signing identity is passed via the Tauri CLI `--config` override, so the
  committed `tauri.conf.json` stays secret-free.
- `src-tauri/entitlements.plist` configures hardened-runtime compatibility
  with the WebKit frameworks Tauri bundles.
