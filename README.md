# YoSelection

YoSelection is a Chrome extension (Manifest V3) that helps YoWorld players build item lists (Wish/Sell/Buy/Sets/Price Check) and export them as PNGs.

Not affiliated with YoWorld.

## Features
- Item search via `api.yoworld.info`
- Saved lists: Wish, Sell, Sets, Buy, Price Check
- Drag-and-drop reorder, notes/prices, image repair
- PNG export (per list or all lists)
- Popup + Side Panel UI

## Install (Developer Mode)
1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `YoSelection` folder

To update after pulling changes: open `chrome://extensions` and click **Reload**.

## Data & Storage
- Lists are stored locally in `chrome.storage.local`.
- Settings (theme + image source) are stored in `chrome.storage.sync`.

## Documentation
- Changelog: `CHANGELOG.md`
- Privacy Policy: `PRIVACY_POLICY.md`
- Release Notes: `YoSelection_v0.1.0_Release_Notes.md`
