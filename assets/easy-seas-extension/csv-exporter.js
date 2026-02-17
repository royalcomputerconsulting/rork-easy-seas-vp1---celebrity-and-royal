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
  const offersData = capturedData.offers;
  
  if (!offersData || !offersData.offers || offersData.offers.length === 0) {
    console.log('[CSV Export] No offers to export');
    return null;
  }

  const offers = offersData.offers;

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
    const campaignOffer = offer.campaignOffer || offer;
    const sailings = campaignOffer.sailings || [];
    
    const offerCode = campaignOffer.offerCode || '';
    const offerName = campaignOffer.name || campaignOffer.offerName || '';
    const offerValue = campaignOffer.tradeInValue || 0;
    const offerExpiryDate = campaignOffer.reserveByDate || campaignOffer.expiryDate || '';
    
    for (const sailing of sailings) {
      const itinerary = sailing.itineraryDescription || sailing.itinerary || '';
      const nights = extractNightsFromText(itinerary) || sailing.numberOfNights || 7;
      
      const shipName = sailing.shipName || '';
      const sailingDate = sailing.sailDate || sailing.sailingDate || '';
      const cabinType = sailing.roomType || sailing.cabinType || 'Balcony';
      const numberOfGuests = sailing.numberOfGuests || (sailing.isGOBO ? '1 Guest' : '2 Guests');
      const departurePort = sailing.departurePort?.name || sailing.departurePort || '';
      
      const portList = sailing.portList || [];
      const portsAndTimes = Array.isArray(portList) ? portList.join(' → ') : '';
      
      const row = [
        escapeCSVField(shipName),
        parseDate(sailingDate),
        escapeCSVField(itinerary),
        escapeCSVField(offerCode),
        escapeCSVField(offerName),
        escapeCSVField(cabinType),
        escapeCSVField(numberOfGuests),
        escapeCSVField('-'),
        escapeCSVField(offerValue),
        '',
        parseDate(offerExpiryDate),
        escapeCSVField(sailing.interiorPrice || 0),
        escapeCSVField(sailing.oceanviewPrice || 0),
        escapeCSVField(sailing.balconyPrice || 0),
        escapeCSVField(sailing.suitePrice || 0),
        escapeCSVField(sailing.taxesAndFees || 0),
        escapeCSVField(portsAndTimes),
        escapeCSVField(numberOfGuests),
        escapeCSVField(nights),
        escapeCSVField(departurePort),
      ];

      rows.push(row.join(','));
    }
  }

  console.log('[CSV Export] Generated', rows.length - 1, 'offer rows');
  return rows.join('\n');
}

function transformBookingsToCSV(capturedData) {
  const bookings = [];
  
  if (capturedData.upcomingCruises?.profileBookings) {
    bookings.push(...capturedData.upcomingCruises.profileBookings);
  }
  
  if (capturedData.courtesyHolds?.payload?.sailingInfo) {
    bookings.push(...capturedData.courtesyHolds.payload.sailingInfo);
  } else if (capturedData.courtesyHolds?.sailingInfo) {
    bookings.push(...capturedData.courtesyHolds.sailingInfo);
  }
  
  if (bookings.length === 0) {
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

  for (const booking of bookings) {
    const sailDate = parseDate(booking.sailDate || booking.sailingStartDate || '');
    const returnDate = parseDate(booking.returnDate || booking.sailingEndDate || '');
    const nights = booking.numberOfNights || booking.nights || 7;
    const shipName = booking.shipName || '';
    const bookingId = booking.bookingId || booking.masterBookingId || '';
    const reservationNumber = booking.reservationNumber || booking.confirmationNumber || '';
    const itinerary = booking.itinerary || booking.cruiseTitle || booking.itineraryDescription || '';
    const departurePort = booking.departurePort?.name || booking.departurePort || '';
    const isBooked = booking.status === 'Booked' || booking.bookingStatus === 'Confirmed' ? 'TRUE' : 'FALSE';
    
    const portList = booking.portList || [];
    const portsRoute = Array.isArray(portList) ? portList.join(', ') : '';
    
    const row = [
      escapeCSVField(`booked-${shipName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`),
      escapeCSVField(shipName),
      sailDate,
      returnDate,
      escapeCSVField(nights),
      escapeCSVField(itinerary),
      escapeCSVField(departurePort),
      escapeCSVField(portsRoute),
      escapeCSVField(reservationNumber),
      escapeCSVField(booking.numberOfGuests || '2'),
      escapeCSVField(bookingId),
      isBooked,
      '',
      ''
    ];

    rows.push(row.join(','));
  }

  console.log('[CSV Export] Generated', rows.length - 1, 'booking rows');
  return rows.join('\n');
}

function exportToCSV(capturedData, includeOffers, includeBookings) {
  console.log('[CSV Export] Starting export with data:', {
    hasOffers: !!capturedData.offers,
    hasUpcomingCruises: !!capturedData.upcomingCruises,
    hasCourtesyHolds: !!capturedData.courtesyHolds,
    includeOffers,
    includeBookings
  });

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
    console.error('[CSV Export] No data to export');
    return { success: false, error: 'No data to export' };
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const cruiseLine = capturedData.cruiseLine || 'royal';
  const filename = `easy-seas-${cruiseLine}-${timestamp}.csv`;
  
  console.log('[CSV Export] Initiating download:', filename);
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[CSV Export] Download failed:', chrome.runtime.lastError);
      return;
    }
    console.log('[CSV Export] Download started with ID:', downloadId);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  
  return { success: true, filename };
}
