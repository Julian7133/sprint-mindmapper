# AuraMindmap — Store launch checklist (P2)

Stand: 24.10.2026. Werte mit `REPLACE_…` sind Platzhalter; hier werden keine IDs geraten. Zeitangaben sind Planungs-Schätzungen für Julians manuelle Arbeit, keine Google/Netlify-Angaben.

## Finale Runde 24.10.

### Entscheidungen (24.10.)

- Launch wird vorbereitet.
- **Zwei OAuth-Clients** im selben Cloud-Projekt: ein **Web-App-Client** für die Preview (`preview-app/config.js:2`) und ein **Chrome-Extension-Client** für die Extension (`extension/manifest.json:24`). Beide fordern nur `drive.file` an. `drive-app-config/README.md:32–34` ist entsprechend angepasst.

### In dieser Runde erledigt

| Was | Datei |
|---|---|
| CWS-Texte neu: Titel, Summary, Langbeschreibung, Kategorie. Claim „Beautiful. Made for Google Drive™. Works with your agents & AI.“ Jede Feature-Aussage ist gegen den Code geprüft. Korrektur: Prioritäten sind 1–7, nicht 1–5. | `extension/store-listing/LISTING.md` |
| CWS-Summary = Manifest-`description` (der Store zeigt den Manifest-Text) | `extension/manifest.json:5` |
| Listing-Felder in der Submission-Anleitung angeglichen | `extension/store-listing/SUBMISSION.md` |
| Marketplace-Texte neu, gleicher Claim, gleiche Struktur; Asset- und Link-Status ergänzt | `preview-app/store-listing/LISTING.md` |
| Marketplace-Banner 220×140 inkl. HTML-Quelle | `preview-app/store-listing/assets/banner-220x140.png` / `.html` |
| Marketplace-Icons 32/48/96/128, skaliert aus `extension/icons/icon-256.png` | `preview-app/store-listing/icons/icon-{32,48,96,128}.png` |
| Preview-Screenshot 1280×800: echte Viewer-UI (`preview-app/`) mit neutraler „Team Plan“-Map. Drive und Google-Login wurden für die Aufnahme lokal gestubbt, ohne Netzwerkzugriff auf Google. | `preview-app/store-listing/screenshots/preview-1280x800.png` |
| CWS Small Promo Tile 440×280 (optional; Items ohne Tile werden nachrangig angezeigt) inkl. HTML-Quelle | `extension/store-listing/promo/promo-440x280.png` / `.html` |
| Two-Client-Entscheidung in die Drive-Setup-Doku übernommen | `drive-app-config/README.md:32–34` |

Markenhinweis: Im Claim steht „Google Drive™“ statt „GDrive“. Grund: Laut Googles Branding-Regeln darf man eine Google-Marke nur mit „for“, „for use with“ oder „compatible with“ voranstellen, mit ™ und Attribution („Google Drive is a trademark of Google LLC“). Ähnliche Kurzformen wie „GDrive“ sind nicht erlaubt ([Marketplace branding guidelines](https://developers.google.com/workspace/marketplace/terms/branding)). Beide Langbeschreibungen enthalten die Attributionszeile.

„Works with your agents & AI“ ist bewusst so belegt, wie es der Code hergibt: Die Maps sind lesbare Markdown-Outlines. Es gibt **keine** eingebaute KI-Funktion, und die Texte behaupten auch keine.

### Zeichenlimits (geprüft 24.10.)

| Feld | Limit | Quelle | Ist |
|---|---:|---|---:|
| CWS Name (`manifest.json` `name`) | 75 | [Manifest name](https://developer.chrome.com/docs/extensions/reference/manifest/name) | 11 |
| CWS Summary (`manifest.json` `description`) | 132 | [Manifest description](https://developer.chrome.com/docs/extensions/reference/manifest/description), [Best listing](https://developer.chrome.com/docs/webstore/best-listing) | 118 |
| CWS Langbeschreibung | kein Limit dokumentiert | [Dashboard listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) | 1.839 |
| Marketplace App-Name | 50 | [Create listing](https://developers.google.com/workspace/marketplace/create-listing) | 18 |
| Marketplace Kurzbeschreibung | 200 | ebd. | 172 |
| Marketplace Langbeschreibung | < 16.000 | ebd. | 1.246 |

Zählung der finalen Textrunde vor den Review-Korrekturen; aktuelle Werte stehen in der Dev-Runde unten.

### Asset-Maße (`sips`, 24.10.)

| Asset | Pflicht? | Soll | Ist (`sips`) |
|---|---|---|---|
| `extension/store-listing/screenshots/editor-1280x800.png` | CWS: Pflicht (≥1) | 1280×800 oder 640×400, ohne Alpha | 1280×800, hasAlpha=no |
| `extension/store-listing/promo/promo-440x280.png` | CWS: optional | 440×280 | 440×280, hasAlpha=no |
| `extension/icons/icon-128.png` | CWS: Pflicht | 128×128 | 128×128 |
| `preview-app/store-listing/screenshots/preview-1280x800.png` | Marketplace: Pflicht (≥1, Google-Integration zeigen) | 1280×800 empfohlen | 1280×800, hasAlpha=no |
| `preview-app/store-listing/assets/banner-220x140.png` | Marketplace: Pflicht | 220×140 | 220×140, hasAlpha=no |
| `preview-app/store-listing/icons/icon-32/48/96/128.png` | Marketplace: Pflicht (32+128; 48+96 bei Web-App) | 32/48/96/128 | 32/48/96/128 |

Quellen: [CWS Supplying Images](https://developer.chrome.com/docs/webstore/images), [Marketplace Create listing](https://developers.google.com/workspace/marketplace/create-listing).

### Aktueller Status nach der Dev-Runde

1. **Domain entschieden und im Worktree umgestellt:** `aura.berlow.de`. Julian richtet DNS/Netlify ein; genaue Schritte stehen im Abschnitt „Dev-Runde 24.10.“. Keine Domain-Registrierung nötig.
2. **Handoff erledigt:** Preview → externe Nachricht → neues Extension-Editorfenster mit aktuellem Markdown-Inhalt. Es wird eine lokale Kopie bearbeitet, Save wählt eine `.md`-Datei auf dem Rechner. Origin-Prüfung, Validierung, Store-Fallback und Browser-E2E sind umgesetzt. Details unten.
3. **Icon-Entscheidung bleibt bei Julian:** Das aktuelle Icon liest sich als „X“, nicht als „A“ (`extension/icons/icon-*.png`; gekreuzte Beine im Generator). Marketplace-Icons stammen daraus. Nach einer Logo-Änderung alle Größen neu erzeugen. Google empfiehlt 96×96 Artwork mit transparentem Rand im 128×128 Icon ([Supplying Images](https://developer.chrome.com/docs/webstore/images)).
4. **Ungültige Permission erledigt:** `windows` aus Manifest und Permission-Tabellen entfernt; `chrome.windows` bleibt nutzbar.
5. **Pflicht-Links:** [Datenschutz](https://berlow.de/datenschutz), [Impressum](https://berlow.de/impressum) und [Kontakt](https://berlow.de/kontakt) existieren (mit Chromium geprüft). Die Datenschutzerklärung behandelt die Website; Julian muss AuraMindmap, Netlify, Drive/OAuth und lokale Handoff-Kopien ergänzen lassen. Allgemeine Kontaktseite als Support-Link eingetragen; produktspezifische Hilfestellung ergänzen. Nutzungsbedingungen fehlen weiterhin. `info@berlow.de` steht im Impressum; Julian muss den Support-/Entwicklerkontakt für die Einreichung festlegen. Keine Rechtstexte wurden erfunden.
6. **Produktname:** Durchgängig „AuraMindmap“ in Consent-, Drive- und Marketplace-Anweisungen. Der bisherige Viewer-Suffix ist entfernt.
7. **Unlisted oder public:** Entscheidung beim ersten CWS-Publish bleibt bei Julian.

### Wohin gehört welche ID / welcher Wert

| Wert | Entsteht in | Gehört nach (Datei:Zeile) |
|---|---|---|
| Web-App-Client-ID (`…apps.googleusercontent.com`) | Cloud Console → APIs & Services → Credentials → OAuth-Client, Typ **Web application** | `preview-app/config.js:2` (`GOOGLE_CLIENT_ID`) |
| Chrome-Extension-Client-ID | Cloud Console → OAuth-Client, Typ **Chrome Extension**, Feld „Item ID“ = Extension-ID | `extension/manifest.json:24` (`oauth2.client_id`) |
| Extension-ID (32 Zeichen) | CWS Developer Dashboard nach dem ersten Paket-Upload (Entwurf) | `preview-app/config.js:3` (`EXTENSION_ID`) und „Item ID“ des Chrome-Extension-Clients |
| CWS-Listing-URL | CWS Developer Dashboard (URL des Items) | `preview-app/config.js:4` (`CWS_LISTING_URL`) |
| Preview-Origin | Festgelegt: `https://aura.berlow.de` | `preview-app/config.js:5`, `extension/background-external.mjs:11`, „Authorized JavaScript origins“ des Web-Clients (`drive-app-config/README.md:29`) |
| Datenschutz-/Nutzungsbedingungs-/Support-URL | Julians gehostete Seiten | CWS → Privacy-Tab + Store listing; Marketplace SDK → Store listing; OAuth-Consent-Screen (Branding) |

Hinweis: Der OAuth-Consent-Screen gilt projektweit für **beide** Clients. Consent-Screen, Drive-App und Marketplace-Listing heißen einheitlich **„AuraMindmap“**.

### Reihenfolge für Julian

| # | Schritt | Details / Stelle | Schätzung |
|---:|---|---|---:|
| 0 | Icon und CWS-Sichtbarkeit entscheiden; offene Dev-/Launch-Prüfungen unten beachten | siehe oben | 15–30 min |
| 1 | DNS für die Subdomain `aura` und Netlify-Custom-Domain einrichten | Dev-Runde: DNS-Tabelle unten | 15–30 min + DNS-Wartezeit |
| 2 | Vorhandenen Datenschutz um AuraMindmap erweitern lassen, Nutzungsbedingungen bereitstellen und Support-Kontakt ergänzen | Blocker 5 | 60–120 min |
| 3 | Netlify deployen (Pfad bereits korrigiert: `base = "preview-app"`, `publish = "."`); Custom-Domain `aura.berlow.de` + HTTPS prüfen | `drive-app-config/README.md:101–109` | 20–45 min |
| 4 | Cloud-Projekt anlegen, Drive API + Marketplace SDK aktivieren, Consent-Screen (Name „AuraMindmap“, Support-E-Mail, Kontakt, Logo, autorisierte Domain, Datenschutz-URL, Scope `drive.file`) | `drive-app-config/README.md:9–21` | 20–40 min |
| 5 | CWS-Entwicklerkonto (einmalig 5 USD laut `SUBMISSION.md:5`), neues Item anlegen, **ersten** ZIP-Upload als Entwurf (`cd extension && npm run pack:store`) → Extension-ID notieren | `extension/store-listing/SUBMISSION.md:12–20` | 20–40 min |
| 6 | Web-App-Client anlegen (Origins `https://aura.berlow.de`, `http://localhost:8888`) → ID in `preview-app/config.js:2` | `drive-app-config/README.md:23–34` | 10–15 min |
| 7 | Chrome-Extension-Client mit der Extension-ID aus Schritt 5 anlegen → ID in `extension/manifest.json:24` | [Chrome OAuth-Anleitung](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth) | 10–15 min |
| 8 | Extension-ID → `preview-app/config.js:3`, CWS-URL → `preview-app/config.js:4`; Netlify neu deployen | — | 10–15 min |
| 9 | `cd extension && npm test && npm run pack:store`; neues ZIP in **dasselbe** CWS-Item hochladen (gleiche ID bleibt) | — | 10–15 min |
| 10 | Drive „Open with“ konfigurieren (Open URL, `text/markdown`/`.md`, Icons) und mit neutraler `.md`-Datei testen | `drive-app-config/README.md:36–46` | 15–25 min |
| 11 | Optional: zweiten Marketplace-Screenshot (Drive-Menü „Open with → AuraMindmap“, 1280×800) aufnehmen | `preview-app/store-listing/LISTING.md`, Abschnitt Graphic assets | 10–15 min |
| 12 | Marketplace-Listing ausfüllen: Texte aus `preview-app/store-listing/LISTING.md`, Banner, Icons, Screenshots, drei Pflicht-Links → einreichen | `drive-app-config/README.md:54–64` | 30–60 min |
| 13 | CWS-Listing ausfüllen: Texte aus `extension/store-listing/LISTING.md`, Screenshot, Promo-Tile, Privacy-Tab (Single Purpose, Permission-Begründungen, Datenschutz-URL), unlisted/public → einreichen | `extension/store-listing/SUBMISSION.md` | 30–45 min |
| 14 | Falls die Cloud Console eine OAuth-Verifikation anfordert: Demo-Video aufnehmen und einreichen. `drive.file` ist laut Google nicht sensibel ([Drive-Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)). Setup-Doku ist korrigiert. | `drive-app-config/README.md:89–99` | 30–60 min (nur falls nötig) |

**Gesamtschätzung Julian:** ca. 4,5–8,5 h aktive Arbeit für die Schritte 0–13 (Summe der Spalte), mit Schritt 14 ca. 5–9,5 h, plus DNS-Wartezeit und Store-Reviews. Laut Repo-Doku (`SUBMISSION.md`, keine Google-Zusage) dauert die CWS-Review 3–10 Werktage. Der Handoff ist umgesetzt; ein echter Drive-/Produktions-Smoke-Test bleibt vor Einreichung erforderlich.

### Validierung dieser Runde

- `npm test` (Root → `editor/`): 87/87 grün. Zuvor 2 Fehler wegen fehlender `editor/node_modules` im Worktree (`jszip` nicht gefunden); behoben mit `npm ci --ignore-scripts` in `editor/`, kein Codeproblem.
- `npm test` in `extension/`: 5 Dateien, 61/61 grün.
- Asset-Maße mit `sips` geprüft (Tabelle oben).
- `git status`: nur die oben genannten Dateien geändert bzw. neu.

## Lokal erledigt (23.10.)

- [x] Store-Screenshot erstellt: `extension/store-listing/screenshots/editor-1280x800.png`, 1280×800. Neutrale Beispielmap, echter lokaler Editor, keine privaten Daten.
- [x] Screenshot-README aktualisiert und Mockup als nicht uploadfähige Vorlage kenntlich gemacht.

## Dev-Runde 24.10.

### Erledigt

- [x] Sämtliche alten Domain-Verweise im Worktree auf `aura.berlow.de` umgestellt, einschließlich Code, Tests, Store-Doku und Architekturvertrag. OAuth autorisiert die registrierbare übergeordnete Domain `berlow.de`.
- [x] **„Edit in AuraMindmap“-Handoff gebaut:** Manifest `externally_connectable`, importierter Listener in `background.js`, mitgepacktes `background-external.mjs`, eigener Request-Schlüssel und eigenes Editorfenster je Klick. Preview übergibt die aktuelle Datei-ID, den Dateinamen und den bereits geladenen Markdown-Inhalt; keine Tokens.
- [x] Origins exakt `https://aura.berlow.de` und `http://localhost:8888`. Das Manifest erlaubt localhost technisch ohne Portbeschränkung; der Listener weist jeden anderen Port ab. IDs, Dateinamen, Nachrichtentyp, Felder und Inhaltsgröße werden geprüft. Obergrenze: 1.048.576 UTF-16-Codeeinheiten Markdown. Fehler führen zu einer sichtbaren Meldung; fehlende Extension führt zum Store.
- [x] **Lokale Kopie:** Browser-Dateispeicher und IndexedDB-Drafts, reload-fest; Save öffnet den lokalen `.md`-Speicherdialog. Die Oberfläche nennt dieses Verhalten ausdrücklich. Kein Drive-Writeback, kein zweiter OAuth-Login. Bestehende Editorfenster und der normale Ordner-Workspace werden erhalten. Vor dem Schließen mit Save als lokale `.md`-Datei sichern. Der Reload desselben Editorfensters erhält die Browserkopie und Drafts; beim Entfernen der Extension werden deren lokale Browserdaten gelöscht.
- [x] Store-Fallback ohne Popup-Abhängigkeit: Navigation im selben Tab. Nach Installation zur Preview zurückkehren, neu laden, Edit erneut klicken. Den erfundenen Datei-ID-Paste-Weg entfernt.
- [x] Review-FIX **CSP:** Selbständiges Sandbox-Dokument für generierte Markmap-Skripte, eigene Response-CSP und `X-Frame-Options: SAMEORIGIN`. Nur dort sind Inline-Skripte erlaubt; der OAuth-/Preview-Hauptrahmen behält seine strengere CSP. Sandbox hat keinen Zugriff auf Parent-DOM oder Tokens, Netzwerkzugriffe sind gesperrt. Browser-Test liest die Policies direkt aus `netlify.toml` und prüft sichtbare Knoten.
- [x] Review-FIX **Import:** XML-/ZIP-Abhängigkeiten in Browser-Bundle; Laufzeitimport zeigt auf das Bundle. XML-Eingaben werden über `TextDecoder` statt Node-Buffer-Methoden gelesen. OPML im echten Extension-Browser geprüft; XMind/FreeMind zusätzlich in den vorhandenen Unit-Tests.
- [x] Review-FIX **Drive-Upload:** Multipart POST und PATCH verwenden jetzt `https://www.googleapis.com/upload/drive/v3/files...`. Tests prüfen die vollständige URL. Ein echter Drive-Upload/Update bleibt Julian-Schritt; „with one click“ ist aus dem Store-Text entfernt.
- [x] Review-FIX **SVG:** Defekten Preview-SVG-Download aus UI und Marketplace-Text entfernt. HTML-Download bleibt. Der Extension-SVG-Export ist davon unabhängig.
- [x] Review-FIX **Store/Setup:** Ctrl/Cmd+1–7 ausdrücklich genannt; Git-/Backlink-/Scope-Jargon in der Beschreibung ersetzt; Name überall AuraMindmap; `drive.file` gemäß [Google](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) nicht sensibel. Ungültige `windows`-Permission entfernt.
- [x] Netlify-Publish-Pfad auf `.` relativ zu `preview-app` korrigiert.

### Julian: DNS, Hosting und Einreichung

| Einstellung | Genauer Wert / Aktion |
|---|---|
| Netlify Base / Publish | `preview-app` / `.`; Konfiguration `preview-app/netlify.toml` verwenden |
| Netlify Custom production domain | `aura.berlow.de` hinzufügen |
| DNS-Zone / Record-Typ | Bestehende Zone `berlow.de`, **CNAME** |
| DNS Name / Host | `aura` (vollqualifiziert `aura.berlow.de`) |
| DNS Target | **Tatsächlicher Site-Hostname `<site-name>.netlify.app` aus Julians Netlify-Projekt.** Der Site-Name ist im Repo nicht hinterlegt; keinen Wert raten. Keine URL, keinen Pfad eintragen. |
| TLS | DNS-Verifikation abwarten, HTTPS-Zertifikat für `aura.berlow.de` in Netlify provisionieren und prüfen |
| OAuth Authorized domain | `berlow.de` (übergeordnete registrierbare Domain) |
| Web-OAuth JavaScript Origins | `https://aura.berlow.de`, `http://localhost:8888` |
| Drive Open URL / Marketplace Open URL | `https://aura.berlow.de/` |
| IDs | Web-Client-ID, Extension-Client-ID, Extension-ID und CWS-URL weiterhin echte Dashboard-Werte einsetzen; keine Platzhalter veröffentlichen |
| Datenschutz / Support / Impressum | Bestehende Links oben; Datenschutz um Produktverhalten erweitern lassen, Support für AuraMindmap kenntlich machen |
| Nutzungsbedingungen | Fehlende öffentliche HTTPS-Seite von Julian bereitstellen; keine vorhandene Seite festgestellt |

Quelle für CNAME und Custom-Domain: [Netlify: externe DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/). Keine DNS- oder Hosting-Änderung wurde ausgeführt.

### Vor Launch noch nachweisen

- [ ] Echter Google-Login mit den beiden konfigurierten Clients: Drive „Open with“ → Preview → Edit. Der lokale Browser-Test simuliert GIS und Drive-Antworten; die externe Extension-Verbindung, das Editorfenster und die Dateiverarbeitung laufen echt.
- [ ] Echter Drive-Sync-Smoke-Test: neue Datei hochladen, danach aktualisieren; Inhalt in Drive kontrollieren (Review-FIX Upload).
- [ ] Auf dem tatsächlichen Netlify-Deployment Response-Header und sichtbare Preview-Knoten prüfen. Die lokale Prüfung verwendet die konfigurierte CSP; Deployment und Header-Übernahme sind noch nicht erfolgt.
- [ ] IDs, DNS/TLS, Produkt-Datenschutz, Nutzungsbedingungen, Support, Logo und Store-Sichtbarkeit erledigen; anschließend Julians Store-/Marketplace-Einreichung.

### Validierung

- Root `npm test`: **87/87 + Round-trip grün**.
- `npm test` in `extension/`: **70/70 grün**, einschließlich Origin-/Nachrichten-Prüfung, Fehlerpfad, separater Requests, Handoff-Workspace/Draft-Reload/Save sowie vollständiger Drive-Upload-URLs.
- `npm test` in `preview-app/`: **13/13 grün**, einschließlich tokenfreier Übergabe, fehlender Extension, Ablehnung und Timeout.
- `npm run test:e2e` in `extension/`: **11 bestanden, 2 bestehende Skips** (Ordner-Picker-Tests). Die drei neuen Tests starten die lokale Preview auf Port 8888, laden die echte unpacked Extension, klicken Edit, prüfen exakten Dateinamen/Inhalt, Reload, zweites Fenster, Browser-Import, falschen Port 8889 und Store-Fallback. GIS und Drive-Antworten sind simuliert; keine echten Konten oder Tokens.
- Preview unter den konfigurierten Netlify-CSPs gerendert; das Sandbox-Dokument kann nicht auf den OAuth-Parent zugreifen. Dokument-Policies verwenden getrennte Pfade, sodass keine konkurrierenden CSP-Werte zusammengeführt werden müssen.
- `npm run pack:store` lokal erfolgreich; ZIP enthält `background-external.mjs` und `editor/import-formats-bundle.js`. Lokales ZIP aktualisiert; nichts hochgeladen.
- Preview-Store-Screenshot neu aufgenommen (echte UI mit simulierter neutraler „Team Plan“-Datei, 1280×800, ohne den entfernten SVG-Button).
- Aktuelle Textlängen: CWS Name **11**, Summary **118**, Langbeschreibung **1.872** Zeichen; Marketplace Name **11**, Summary **165**, Langbeschreibung **1.261** Zeichen. Alle innerhalb der oben dokumentierten Grenzen.
- Domain-Suche: `rg --hidden --no-ignore -n 'auramindmap[.]com' -g '!**/node_modules/**' -g '!.git' .` liefert **0 Treffer** (Exit 1 = keine Treffer); zusätzlich alle ZIP-Einträge entpackt auf die alte Domain geprüft. Keine Ausnahmen.
- `git diff --check` sauber. Keine Commits, Pushes, DNS-Änderungen, Deployments oder Uploads.

### Geänderte Pfade dieser Dev-Runde

- Handoff: `extension/manifest.json`, `extension/background.js`, `extension/background-external.mjs`, `extension/editor/workspace-extension.mjs`, `extension/editor/app.js`, `extension/editor/style.css`, `preview-app/app.js`, `preview-app/edit-handoff.js`, `preview-app/config.js`.
- Review-Fixes/Build: `extension/build.js`, `extension/.gitignore`, `extension/editor/import-formats.mjs`, `editor/import-formats.mjs`, `extension/editor/drive-sync.mjs`, `extension/editor/service-worker.js`, `extension/scripts/pack-store.mjs`, `extension/auramindmap-extension.zip`, `preview-app/index.html`, `preview-app/netlify.toml`, `preview-app/preview-frame.html`, `preview-app/preview-frame.js`.
- Tests: `extension/tests/unit/background-external.test.mjs`, `extension/tests/unit/drive-sync.test.mjs`, `extension/tests/unit/workspace-extension.test.mjs`, `extension/tests/e2e/handoff.spec.js`, `preview-app/tests/unit/edit-handoff.test.js`.
- Doku/Store: `Agents.md`, `GOOGLE-WORKSPACE-DISTRIBUTION-PLAN.md`, `drive-app-config/README.md`, `extension/store-listing/LISTING.md`, `extension/store-listing/PRIVACY-POLICY.md`, `preview-app/store-listing/LISTING.md`, `preview-app/store-listing/screenshots/preview-1280x800.png`, diese Checkliste. Die übrigen vorgefundenen Store-Texte und Assets bleiben im Worktree.
