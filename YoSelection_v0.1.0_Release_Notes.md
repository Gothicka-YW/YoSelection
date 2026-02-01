# YoSelection v0.1.0 — Release Notes

**Release date:** 2026-01-31

## Highlights
- **Search results are richer:** each search result now shows Item Name, Item ID, and **In store: Yes/No**.
- **Price Check now behaves like a real list:** you can save Price Check items into a grid (like Wish), refresh/repair/clear them, and export them as PNG.
- **Faster adding with Enter:** when you paste an item ID/link, pressing Enter saves it and clears the fields.
- **Label cleanup:** “Sell Sets” is now simply **“Sets”**.
- **More themes:** Ocean, Forest, and Sunset.

## Feature details

### Search results
- Results now show:
  - Item name
  - Item ID
  - In-store status (Yes/No)

### Price Check list
- Price Check includes a saved list grid with:
  - Drag/reorder
  - Edit note/price
  - Refresh store status
  - Repair broken images
  - Clear list

### PNG Export
- Export scope includes Price Check.
- Price Check exports with the same layout rules as Wish List (up to 50 items per image).

### Keyboard behavior
- In Add Item:
  - If Search contains an item ID/link, Enter adds it and clears Search/Note.
  - Otherwise, Enter runs a normal search.
- In Price Check:
  - If the Price Check search contains an item ID/link, Enter adds it to the Price Check list and clears the field.

## Known limitations
- Lists are stored locally (not synced) by design to avoid Chrome Sync quota issues.
- In-store status comes from `api.yoworld.info` and depends on that service’s availability.

## Install / Update
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `YoSelection` folder
4. Pin the extension (optional)

To update: reload the extension on `chrome://extensions` after pulling changes.
