# Easy Seas™ Extension - Installation Guide

## Quick Installation Steps

### 1. Prepare the Extension Files

First, make sure you have all the extension files in a folder. The folder should contain:
- `manifest.json`
- `content.js`
- `background.js`
- `popup.html`
- `popup.js`
- `csv-exporter.js`
- `icons/` folder with icon files

### 2. Add Extension Icons

**IMPORTANT:** Before installing, you need to add icon files to the `icons/` folder.

#### Option A: Create Simple Icons
You can create simple placeholder icons using any image editor:
- Create three PNG files: `icon16.png`, `icon48.png`, `icon128.png`
- Use a simple anchor emoji ⚓ or ship 🚢 as the icon
- Or download icons from [icons8.com](https://icons8.com) or [flaticon.com](https://flaticon.com)

#### Option B: Use Existing Images
Copy any PNG images and rename them to:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

### 3. Install in Chrome

1. **Open Chrome Extensions Page**
   ```
   Type in address bar: chrome://extensions/
   Or: Menu → More Tools → Extensions
   ```

2. **Enable Developer Mode**
   - Look for the toggle in the top-right corner
   - Turn it ON (it should turn blue)

3. **Load the Extension**
   - Click the "Load unpacked" button (appears after enabling Developer mode)
   - Browse to and select the `easy-seas-extension` folder
   - Click "Select Folder"

4. **Verify Installation**
   - The extension should appear in your extensions list
   - You should see the Easy Seas icon in your toolbar
   - If you don't see it, click the puzzle piece icon and pin it

### 4. Test the Extension

1. Go to [royalcaribbean.com](https://www.royalcaribbean.com)
2. Log in to your account
3. Navigate to Club Royale → Offers
4. Click the Easy Seas extension icon
5. You should see data being captured

## Troubleshooting Installation

### "Manifest file is missing or unreadable"
- Make sure all files are in the same folder
- Check that `manifest.json` exists and is properly formatted
- Don't modify the manifest.json file

### "Could not load icon"
- Add the icon files to the `icons/` folder as described in Step 2
- Make sure the files are named exactly: `icon16.png`, `icon48.png`, `icon128.png`
- Icons must be PNG format

### Extension loads but doesn't work
- Make sure you're on royalcaribbean.com or celebritycruises.com
- Check that you're logged in
- Open browser console (F12) and look for any error messages
- Try refreshing the page

### Extension icon doesn't appear in toolbar
- Click the puzzle piece icon in Chrome toolbar
- Find "Easy Seas™ - Royal Caribbean Sync"
- Click the pin icon to keep it visible

## Updating the Extension

When a new version is available:

1. Download the new extension files
2. Go to `chrome://extensions/`
3. Find the Easy Seas extension
4. Click the "Reload" button (circular arrow icon)

Or remove and reinstall:
1. Click "Remove" on the old version
2. Follow the installation steps above with new files

## Next Steps

Once installed, see the main README.md for:
- How to use the extension
- Exporting data to CSV
- Importing into the Easy Seas app

---

Need help? Contact Easy Seas support.
