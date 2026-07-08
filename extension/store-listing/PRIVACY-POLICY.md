# AuraMindmap Privacy Policy

**Last updated:** July 8, 2026

AuraMindmap ("the extension") is a mind-map editor for sprint planning. This policy describes what data the extension handles and how.

## Summary

- Your mindmap files stay on your device unless you explicitly enable Google Drive sync.
- We do not collect analytics, telemetry, or personal information.
- All editor code is bundled in the extension — no remote scripts are loaded at runtime.

## Local storage

When you choose a folder, the extension reads and writes `.md` mindmap files and companion `.html` markmap previews in that folder using the browser File System Access API. Folder access requires your explicit permission each session (or reconnect after reinstall).

Draft edits may be stored in IndexedDB on your device until you save or discard them.

Extension preferences (recent files, active file, optional Drive sync metadata) are stored in `chrome.storage.local` on your device.

## Optional Google Drive sync

If you enable Drive sync, the extension requests the `drive.file` OAuth scope. This allows creating and updating files **only in an app-specific "AuraMindmap" folder** that the extension creates in your Google Drive. The extension cannot access other Drive files.

Google authentication uses Chrome's Identity API (`chrome.identity.getAuthToken`). Tokens are managed by Chrome; we do not operate a backend server.

You can disable Drive sync and sign out at any time from the file panel.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save drafts, recent files, and workspace preferences locally |
| `sidePanel` | Optional companion side panel for quick capture |
| `windows` | Open the editor in a dedicated window |
| `identity` (optional) | Google Drive sync only, when you enable it |

The File System Access API does not require an extension permission.

## Third parties

Mind-map rendering uses bundled open-source libraries (MindElixir, markmap). No CDN or third-party runtime is invoked when you edit or save.

## Contact

For privacy questions, open an issue on the project repository or contact the maintainer listed on the Chrome Web Store listing.

## Changes

We may update this policy. The "Last updated" date will change when we do. Continued use after changes constitutes acceptance of the revised policy.
