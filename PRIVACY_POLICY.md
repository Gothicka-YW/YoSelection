# Privacy Policy — YoSelection

**Effective date:** 2026-01-31

YoSelection is a personal helper Chrome extension for YoWorld players to build and export item lists (Wish/Sell/Sets/Buy/Price Check).

This extension is **not affiliated with YoWorld**.

## Summary
- YoSelection stores your lists locally in your browser.
- YoSelection syncs only lightweight settings (theme + image source) via Chrome Sync (if enabled).
- YoSelection fetches item data from `api.yoworld.info` when you search or refresh items.
- YoSelection does **not** collect analytics, run ads, or sell your data.

## Data the extension stores

### Stored in `chrome.storage.local` (on your device)
- **Your lists** (Wish, Sell, Sets, Buy, Price Check):
  - Item ID and name
  - Optional note/price text
  - Image URLs used for thumbnails/exports
  - Store status (in-store / not-in-store)
  - Timestamps used for ordering/uniqueness

These lists are stored locally so they are reliable and do not hit Chrome Sync quota limits.

### Stored in `chrome.storage.sync` (synced with your Chrome profile, if Chrome Sync is enabled)
- **Settings**:
  - Theme selection
  - Preferred image source (CDN / YoWorld.info / Auto)

### Stored in `localStorage` (on your device)
- **UI convenience state**, such as:
  - Last opened tab
  - Draft text you were typing in Add Item fields per tab

## Data the extension does NOT store
- Your YoWorld login or password
- Cookies from YoWorld
- Payment information
- Personal identifiers beyond what you type into notes

## Network access
YoSelection makes network requests to support searches and lookups:
- `https://api.yoworld.info/api/items/search` — item search
- `https://api.yoworld.info/api/items/<id>` — item details (name + in-store status)
- `https://api.yoworld.info/extension.php?x=...` — image proxy/fallback for broken CDN images

YoSelection may also load images from:
- `https://yw-web.yoworld.com/cdn/items/...` (YoWorld CDN)

Requests are made only when you:
- Search for items
- Refresh items
- Repair images
- Export PNGs (to load images into the canvas)

## Permissions
YoSelection requests these Chrome permissions:
- `storage` — to save your lists and settings
- `sidePanel` — to support opening the extension in a side panel

Host permissions are used to allow fetch/image loads from:
- `https://api.yoworld.info/*`
- `https://yw-web.yoworld.com/*`

## Export behavior
When you export a PNG, YoSelection renders an image locally using an HTML canvas in the popup/side panel. The exported image is downloaded to your computer by your browser.

## Children’s privacy
YoSelection is not designed for children under 13 and does not knowingly collect personal information from children.

## Changes to this policy
This policy may be updated to reflect new features or legal requirements. The effective date at the top will be updated when changes are made.

## Contact
If you have questions or concerns about this privacy policy, contact the developer/maintainer through the project repository.
