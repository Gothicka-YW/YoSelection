# Changelog — YoSelection

All notable changes to **YoSelection** will be documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] — 2026-01-31

### Added
- Search results now display **Item Name**, **Item ID**, and **In store: Yes/No**.
- Price Check is now a **saved list** (like Wish/Sell/Buy/Sets):
  - Add items into Price Check from the Add Item section.
  - Add the currently selected Price Check item into the saved list.
  - Refresh / Repair Images / Clear controls for Price Check.
  - Export Price Check list as PNG using the same layout rules as Wish List.
- Quality-of-life “quick add” with Enter:
  - In Add Item Search/Note: Enter adds when input is an ID/link, then clears fields.
  - In Price Check search: Enter adds when input is an ID/link, then clears the field.
- Three new color themes: **Ocean**, **Forest**, **Sunset**.

### Changed
- UI label renamed from **“Sell Sets”** to **“Sets”** (internal storage key remains `sellSets`).

### Notes
- Lists are stored in `chrome.storage.local` (not synced). Settings (theme + image source) are stored in `chrome.storage.sync`.
