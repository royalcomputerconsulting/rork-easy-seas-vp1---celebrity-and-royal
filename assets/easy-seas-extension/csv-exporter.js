function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  
  const trimmed = dateStr.trim();
  
  try {
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2];
      const day = isoMatch[3];
      return `${month}-${day}-${year}`;
    }
    
    const mmddyyyyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (mmddyyyyDash) {
      const month = mmddyyyyDash[1].padStart(2, '0');
      const day = mmddyyyyDash[2].padStart(2, '0');
      const year = mmddyyyyDash[3];
      return `${month}-${day}-${year}`;
    }
    
    const mmddyyyySlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mmddyyyySlash) {
      const month = mmddyyyySlash[1].padStart(2, '0');
      const day = mmddyyyySlash[2].padStart(2, '0');
      const year = mmddyyyySlash[3].length === 2 ? '20' + mmddyyyySlash[3] : mmddyyyySlash[3];
      return `${month}-${day}-${year}`;
    }
    
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${month}-${day}-${year}`;
    }
  } catch (e) {
    console.warn('[CSV Export] Failed to parse date:', dateStr);
  }
  
  return dateStr;
}

function extractNightsFromText(text) {
  if (!text) return null;
  const nightsMatch = text.match(/(\d+)\s*[-]?\s*night/i);
  if (nightsMatch) {
    const nights = parseInt(nightsMatch[1], 10);
    if (nights > 0 && nights <= 365) {
      return nights;
    }
  }
  return null;
}

function transformOffersToCSV(capturedData) {
  const offers = capturedData.offers?.offers || [];
  
  if (offers.length === 0) {
    console.log('[CSV Export] No offers to export');
    return null;
  }

  const headers = [
    'Ship Name',
    'Sailing Date',
    'Itinerary',
    'Offer Code',
    'Real Offer Name',
    'Room Type',
    'Guests Info',
    'Perks',
    'Offer Value',
    'Offer Expiry Date Alt',
    'Offer Expiry Date',
    'Price Interior',
    'Price Ocean View',
    'Price Balcony',
    'Price Suite',
    'Taxes & Fees',
    'Ports & Times',
    'Offer Type / Category',
    'Nights',
    'Departure Port',
  ];

  const rows = [headers.join(',')];

  for (const offer of offers) {
    for (const sailing of offer.sailings || []) {
      const nights = extractNightsFromText(sailing.itinerary) || 7;
      const portsAndTimes = sailing.portList?.join(' → ') || '';
      
      const row = [
        escapeCSVField(sailing.shipName || ''),
        parseDate(sailing.sailingDate),
        escapeCSVField(sailing.itinerary || ''),
        escapeCSVField(offer.offerCode || ''),
        escapeCSVField(offer.offerName || ''),
        escapeCSVField(sailing.cabinType || 'Balcony'),
        escapeCSVField(sailing.numberOfGuests || '2 Guests'),
        escapeCSVField(offer.perks || '-'),
        escapeCSVField(offer.offerValue || 0),
        '',
        parseDate(offer.offerExpirationDate),
        escapeCSVField(sailing.interiorPrice || 0),
        escapeCSVField(sailing.oceanviewPrice || 0),
        escapeCSVField(sailing.balconyPrice || 0),
        escapeCSVField(sailing.suitePrice || 0),
        escapeCSVField(sailing.taxesAndFees || 0),
        escapeCSVField(portsAndTimes),
        escapeCSVField(offer.offerType || '2 Guests'),
        escapeCSVField(nights),
        escapeCSVField(sailing.departurePort || ''),
      ];

      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}

function transformBookingsToCSV(capturedData) {
  const bookings = capturedData.upcomingCruises?.profileBookings || [];
  const holds = capturedData.courtesyHolds?.payload?.sailingInfo || capturedData.courtesyHolds?.sailingInfo || [];
  
  const allBookings = [...bookings, ...holds];
  
  if (allBookings.length === 0) {
    console.log('[CSV Export] No bookings to export');
    return null;
  }

  const headers = [
    'id',
    'ship',
    'departureDate',
    'returnDate',
    'nights',
    'itineraryName',
    'departurePort',
    'portsRoute',
    'reservationNumber',
    'guests',
    'bookingId',
    'isBooked',
    'winningsBroughtHome',
    'cruisePointsEarned'
  ];

  const rows = [headers.join(',')];

  for (const booking of allBookings) {
    const sailDate = parseDate(booking.sailDate || booking.sailingStartDate);
    const returnDate = parseDate(booking.returnDate || booking.sailingEndDate);
    const nights = booking.numberOfNights || booking.nights || 7;
    const bookingId = booking.bookingId || booking.masterBookingId || '';
    const isBooked = booking.status === 'Booked' || booking.bookingStatus === 'Confirmed' ? 'TRUE' : 'FALSE';
    
    const row = [
      escapeCSVField(`booked-${booking.shipName?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`),
      escapeCSVField(booking.shipName || ''),
      sailDate,
      returnDate,
      escapeCSVField(nights),
      escapeCSVField(booking.itinerary || booking.cruiseTitle || ''),
      escapeCSVField(booking.departurePort || ''),
      escapeCSVField(booking.portList?.join(', ') || ''),
      escapeCSVField(booking.reservationNumber || ''),
      escapeCSVField(booking.numberOfGuests || '2'),
      escapeCSVField(bookingId),
      isBooked,
      '',
      ''
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function exportToCSV(capturedData, includeOffers, includeBookings) {
  let csvContent = '';
  
  if (includeOffers) {
    const offersCSV = transformOffersToCSV(capturedData);
    if (offersCSV) {
      csvContent += offersCSV;
    }
  }
  
  if (includeBookings) {
    const bookingsCSV = transformBookingsToCSV(capturedData);
    if (bookingsCSV) {
      if (csvContent) csvContent += '\n\n';
      csvContent += bookingsCSV;
    }
  }
  
  if (!csvContent) {
    return { success: false, error: 'No data to export' };
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `easy-seas-${capturedData.cruiseLine}-${timestamp}.csv`;
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[CSV Export] Download failed:', chrome.runtime.lastError);
      return { success: false, error: chrome.runtime.lastError.message };
    }
    console.log('[CSV Export] Download started:', downloadId);
    URL.revokeObjectURL(url);
  });
  
  return { success: true, filename };
}
