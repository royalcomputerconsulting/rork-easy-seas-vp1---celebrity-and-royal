# Packaging the Easy Seas™ Extension

## For Distribution

### Step 1: Add Icons

Before packaging, create or add icon files to the `icons/` folder:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)  
- `icon128.png` (128x128px)

Recommended tools:
- Use Figma, Canva, or Photoshop
- Or use an online icon generator
- Theme: Anchor ⚓, ship 🚢, or cruise related imagery
- Colors: Blue (#3b82f6) matching the app brand

### Step 2: Test Locally

1. Load the extension in Chrome (see INSTALL.md)
2. Test on royalcaribbean.com
3. Verify data capture works
4. Test CSV export
5. Import CSV into Easy Seas app to verify format

### Step 3: Create ZIP Package

```bash
cd assets
zip -r easy-seas-extension.zip easy-seas-extension/ -x "*.DS_Store" -x "*/.git/*" -x "*/node_modules/*"
```

Or manually:
1. Select all files in `easy-seas-extension/` folder
2. Right-click → Compress/Create Archive
3. Name it `easy-seas-extension.zip`

### Step 4: Chrome Web Store Publishing (Optional)

To publish on Chrome Web Store:

1. **Create Developer Account**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay $5 one-time registration fee

2. **Prepare Store Listing**
   - Create promotional images (1280x800, 640x400, 440x280)
   - Write description (copy from README.md)
   - Add screenshots of the extension in action
   - Prepare privacy policy (template below)

3. **Upload Extension**
   - Upload the ZIP file
   - Fill in all required fields
   - Submit for review (usually takes 1-3 days)

### Privacy Policy Template

```
Privacy Policy for Easy Seas™ Extension

Data Collection:
- This extension does NOT collect any personal data
- All data processing happens locally in your browser
- No data is sent to external servers
- No analytics or tracking

Data Usage:
- Captures cruise data from Royal Caribbean/Celebrity websites
- Data is used only to generate CSV exports for the Easy Seas app
- You control when data is exported

Data Storage:
- Captured data is stored temporarily in browser local storage
- Data can be cleared at any time using the "Clear Data" button
- No data persists after you close your browser

Third Parties:
- No data is shared with any third parties
- The extension only interacts with royalcaribbean.com and celebritycruises.com

Contact:
For questions about this policy, contact: [your-email@domain.com]

Last Updated: [Current Date]
```

## File Structure for Distribution

The ZIP should contain:
```
easy-seas-extension/
├── manifest.json
├── content.js
├── background.js
├── popup.html
├── popup.js
├── csv-exporter.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── INSTALL.md
└── PACKAGING.md (optional, can exclude)
```

## Version Updates

To release a new version:

1. Update version number in `manifest.json`
2. Document changes
3. Test thoroughly
4. Create new ZIP package
5. Upload to Chrome Web Store (if published)
6. Users will auto-update within 24-48 hours

## Distribution Methods

### Method 1: Direct Download
- Host the ZIP file on your website
- Users download and install manually
- Provide INSTALL.md instructions

### Method 2: Chrome Web Store
- Official distribution channel
- Automatic updates
- Better user trust
- Requires $5 registration

### Method 3: GitHub Release
- Create a GitHub repository
- Add ZIP to releases
- Users can download and track updates
- Free and open source friendly

## Testing Checklist

Before distributing:
- [ ] Extension loads without errors
- [ ] Icons display correctly
- [ ] Data captures from Royal Caribbean
- [ ] Data captures from Celebrity Cruises
- [ ] Login detection works
- [ ] Offer count updates correctly
- [ ] Booking count updates correctly
- [ ] CSV export works
- [ ] CSV imports into Easy Seas app successfully
- [ ] Clear data function works
- [ ] Refresh data function works
- [ ] No console errors
- [ ] Works in Chrome, Edge, Brave

## Support

Provide these resources to users:
- INSTALL.md for installation
- README.md for usage
- Your support email/contact
- FAQ section (create based on user questions)

---

Ready to distribute? Make sure all checkboxes above are completed!
