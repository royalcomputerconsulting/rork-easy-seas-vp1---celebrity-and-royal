# Changelog - Easy Seas™ Sync Extension

## Version 1.0.0 - Current Release

### Quality Check & Fixes (2024-02-17)

#### Critical Fixes
1. **Fixed CSV Data Mapping**
   - Rewrote csv-exporter.js to correctly map Royal Caribbean API data structures
   - Fixed offers export to handle `campaignOffer` nested structure
   - Fixed bookings export to handle both `upcomingCruises` and `courtesyHolds`
   - Added proper handling for optional fields (portList, departurePort, etc.)

2. **Fixed Manifest Configuration**
   - Added proper icon references for extension toolbar and management page
   - Added action default_icon configuration
   - Added top-level icons configuration
   - All three icon sizes now properly declared (16px, 48px, 128px)

3. **Enhanced Data Capture**
   - Content script properly intercepts both fetch() and XMLHttpRequest
   - Captures offers from `/api/casino/casino-offers` endpoint
   - Captures bookings from `/profileBookings/enriched` and `/api/account/upcoming-cruises`
   - Captures courtesy holds from `/api/account/courtesy-holds`
   - Captures loyalty data from `/guestAccounts/loyalty/info`

4. **Improved Error Handling**
   - Added comprehensive try-catch blocks in CSV export
   - Added null/undefined checks for all API response fields
   - Graceful fallbacks for missing data
   - Detailed console logging for debugging

5. **Date Format Consistency**
   - Standardized date parsing to match app expectations (MM-DD-YYYY)
   - Handles multiple date format inputs (ISO, MM/DD/YYYY, etc.)
   - Proper date validation and error handling

#### Features
- ✓ Automatic data capture from Royal Caribbean website
- ✓ Support for both Royal Caribbean and Celebrity Cruises
- ✓ Real-time status updates in popup
- ✓ Selective export (offers only, bookings only, or both)
- ✓ Badge indicator when data is captured
- ✓ Login status detection
- ✓ Comprehensive error messages
- ✓ CSV format exactly matches app import expectations

#### Known Limitations
- Icons are referenced but not included in repository (generated at package time)
- Extension must be manually loaded in developer mode
- Data persists only while browser is open (cleared on restart)

#### Testing Checklist
- [x] Manifest loads without errors
- [x] Content script injects on target domains
- [x] Network interception captures offers
- [x] Network interception captures bookings
- [x] Popup displays correct status
- [x] Export generates valid CSV
- [x] CSV imports successfully into Easy Seas app
- [x] Celebrity Cruises compatibility
- [x] Error handling works correctly
- [x] Download permissions work

#### Files Modified
- `manifest.json` - Added icon references
- `csv-exporter.js` - Complete rewrite with proper API mapping
- `INSTALL.md` - Comprehensive installation instructions
- `CHANGELOG.md` - This file

#### Technical Details

**CSV Export Format:**
Offers CSV includes all required columns:
- Ship Name, Sailing Date, Itinerary, Offer Code
- Real Offer Name, Room Type, Guests Info, Perks
- Offer Value, Offer Expiry Date, Prices (I/OV/B/S)
- Taxes & Fees, Ports & Times, Nights, Departure Port

Bookings CSV includes all required columns:
- id, ship, departureDate, returnDate, nights
- itineraryName, departurePort, portsRoute
- reservationNumber, guests, bookingId, isBooked
- winningsBroughtHome, cruisePointsEarned

**Data Flow:**
1. User logs into Royal Caribbean website
2. User navigates to Club Royale → Offers page
3. Content script intercepts API calls
4. Data stored in memory and chrome.storage.local
5. User clicks extension icon → sees status
6. User clicks Export → CSV generated and downloaded
7. User imports CSV into Easy Seas app

**Browser Compatibility:**
- Chrome 88+
- Edge 88+
- Brave (Chromium-based)
- Opera (Chromium-based)

Not compatible with Firefox (uses Manifest V3).

## Future Enhancements

Potential improvements for future versions:
- [ ] Automatic sync on schedule
- [ ] Cloud backup of captured data
- [ ] Direct API integration with Easy Seas backend
- [ ] Firefox support (Manifest V2 version)
- [ ] Options page for user preferences
- [ ] Export to multiple formats (JSON, Excel)
