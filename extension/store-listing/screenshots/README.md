# Store screenshots

Chrome Web Store requires at least one **1280×800** screenshot. Optional: **440×280** small promo tile.

## Capturing screenshots

1. Load the unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked → `extension/`).
2. Open the editor window (popup → **Open AuraMindmap**).
3. Connect a folder with a sample mind map, or create a new file with a few nodes and priorities.
4. Resize the editor window to **1280×800** (DevTools → device toolbar → custom dimensions).
5. Capture:
   - **Screenshot 1:** Full editor with mind map visible and toolbar
   - **Screenshot 2 (optional):** File panel open showing folder + Drive sync affordance
   - **Screenshot 3 (optional):** Side panel via popup → **Open side panel**

Save PNGs in this folder:

```
screenshots/
  editor-1280x800.png
  file-panel-1280x800.png
  side-panel-1280x800.png
  promo-440x280.png
```

## Promo tile

Crop or redesign the hero frame to 440×280. Keep the product name readable and show the mind map canvas.

## Automated capture (optional)

Playwright can capture the editor shell without a connected folder:

```bash
cd extension
npm run test:e2e -- --grep "editor page renders"
```

For full map content, manual capture with a connected folder is still required (File System Access API cannot be automated in CI).
