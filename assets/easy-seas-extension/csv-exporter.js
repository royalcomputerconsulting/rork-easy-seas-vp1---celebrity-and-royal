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
    if (nights > 0 && nights <= 365) return nights;
  }
  return null;
}

function generateOffersCSV(offersData, loyaltyData) {
  if (!offersData || !offersData.offers || offersData.offers.length === 0) {
    console.log('[CSV Export] No offers to export');
    return null;
  }

  const offers = offersData.offers;
  const headers = [
    'Source Page',
    'Offer Name',
    'Offer Code',
    'Offer Expiration Date',
    'Offer Type',
    'Ship Name',
    'Sailing Date',
    'Itinerary',
    'Departure Port',
    'Cabin Type',
    'Number of Guests',
    'Perks',
    'Loyalty Level',
    'Loyalty Points',
    'Interior Price',
    'Oceanview Price',
    'Balcony Price',
    'Suite Price',
    'Port List'
  ];

  const rows = [headers.join(',')];
  let totalSailings = 0;

  for (const offer of offers) {
    const campaignOffer = offer.campaignOffer || offer;
    const sailings = campaignOffer.sailings || [];
    
    const offerCode = campaignOffer.offerCode || '';
    const offerName = campaignOffer.name || campaignOffer.offerName || '';
    const offerExpiryDate = parseDate(campaignOffer.reserveByDate || campaignOffer.expiryDate || '');
    const offerType = campaignOffer.offerType || campaignOffer.type || 'Free Play';
    
    for (const sailing of sailings) {
      const itinerary = sailing.itineraryDescription || sailing.itinerary || '';
      const nights = extractNightsFromText(itinerary) || sailing.numberOfNights || 7;
      
      const shipName = sailing.shipName || '';
      const sailingDate = parseDate(sailing.sailDate || sailing.sailingDate || '');
      const cabinType = sailing.roomType || sailing.cabinType || 'Balcony';
      const numberOfGuests = sailing.numberOfGuests || (sailing.isGOBO ? '1' : '2');
      const departurePort = sailing.departurePort?.name || sailing.departurePort || '';
      
      const portList = Array.isArray(sailing.portList) ? sailing.portList.join(', ') : '';
      const perks = '-';
      
      const loyaltyLevel = loyaltyData?.crownAndAnchorLevel || '';
      const loyaltyPoints = loyaltyData?.crownAndAnchorPoints || '';

      const row = [
        escapeCSVField('Club Royale Offers'),
        escapeCSVField(offerName),
        escapeCSVField(offerCode),
        escapeCSVField(offerExpiryDate),
        escapeCSVField(offerType),
        escapeCSVField(shipName),
        escapeCSVField(sailingDate),
        escapeCSVField(itinerary),
        escapeCSVField(departurePort),
        escapeCSVField(cabinType),
        escapeCSVField(numberOfGuests),
        escapeCSVField(perks),
        escapeCSVField(loyaltyLevel),
        escapeCSVField(loyaltyPoints),
        escapeCSVField(sailing.interiorPrice || ''),
        escapeCSVField(sailing.oceanviewPrice || ''),
        escapeCSVField(sailing.balconyPrice || ''),
        escapeCSVField(sailing.suitePrice || ''),
        escapeCSVField(portList)
      ];

      rows.push(row.join(','));
      totalSailings++;
    }
  }

  console.log('[CSV Export] Generated', totalSailings, 'offer sailings from', offers.length, 'offers');
  return rows.join('\n');
}

function generateBookedCruisesCSV(bookingsData, loyaltyData) {
  const bookings = [];
  
  if (bookingsData.upcomingCruises?.profileBookings) {
    bookings.push(...bookingsData.upcomingCruises.profileBookings.map(b => ({ ...b, source: 'Upcoming' })));
  }
  
  if (bookingsData.courtesyHolds?.payload?.sailingInfo) {
    bookings.push(...bookingsData.courtesyHolds.payload.sailingInfo.map(b => ({ ...b, source: 'Courtesy Hold' })));
  } else if (bookingsData.courtesyHolds?.sailingInfo) {
    bookings.push(...bookingsData.courtesyHolds.sailingInfo.map(b => ({ ...b, source: 'Courtesy Hold' })));
  }
  
  if (bookings.length === 0) {
    console.log('[CSV Export] No bookings to export');
    return null;
  }

  const headers = [
    'Source Page',
    'Ship Name',
    'Sailing Start Date',
    'Sailing End Date',
    'Sailing Date(s)',
    'Itinerary',
    'Departure Port',
    'Cabin Type',
    'Cabin Number/GTY',
    'Booking ID',
    'Status',
    'Loyalty Level',
    'Loyalty Points'
  ];

  const rows = [headers.join(',')];

  const SHIP_CODE_MAP = {
    'AL': 'Allure of the Seas', 'AN': 'Anthem of the Seas', 'AD': 'Adventure of the Seas',
    'BR': 'Brilliance of the Seas', 'EN': 'Enchantment of the Seas', 'EX': 'Explorer of the Seas',
    'FR': 'Freedom of the Seas', 'GR': 'Grandeur of the Seas', 'HM': 'Harmony of the Seas',
    'IC': 'Icon of the Seas', 'ID': 'Independence of the Seas', 'JW': 'Jewel of the Seas',
    'LB': 'Liberty of the Seas', 'LE': 'Legend of the Seas', 'MJ': 'Majesty of the Seas',
    'MR': 'Mariner of the Seas', 'NV': 'Navigator of the Seas', 'OA': 'Oasis of the Seas',
    'OV': 'Ovation of the Seas', 'OY': 'Odyssey of the Seas', 'QN': 'Quantum of the Seas',
    'RD': 'Radiance of the Seas', 'RH': 'Rhapsody of the Seas', 'SE': 'Serenade of the Seas',
    'SP': 'Spectrum of the Seas', 'SY': 'Symphony of the Seas', 'UT': 'Utopia of the Seas',
    'VI': 'Vision of the Seas', 'VY': 'Voyager of the Seas', 'WN': 'Wonder of the Seas'
  };

  const STATEROOM_TYPE_MAP = {
    'I': 'Interior', 'O': 'Ocean View', 'B': 'Balcony', 'S': 'Suite'
  };

  for (const booking of bookings) {
    const shipCode = booking.shipCode || '';
    const shipName = SHIP_CODE_MAP[shipCode] || booking.shipName || (shipCode ? shipCode + ' of the Seas' : '');
    
    const sailDate = parseDate(booking.sailDate || booking.sailingStartDate || '');
    const nights = booking.numberOfNights || 7;
    
    let returnDate = parseDate(booking.returnDate || booking.sailingEndDate || '');
    if (!returnDate && sailDate && nights) {
      const startParts = sailDate.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (startParts) {
        const [, month, day, year] = startParts;
        const startDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        startDateObj.setDate(startDateObj.getDate() + nights);
        returnDate = `${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}-${startDateObj.getFullYear()}`;
      }
    }
    
    const sailingDates = booking.sailingDates || `${sailDate} - ${returnDate}`;
    const itinerary = booking.itinerary || booking.cruiseTitle || booking.itineraryDescription || `${nights} Night Cruise`;
    const departurePort = booking.departurePort?.name || booking.departurePort || '';
    
    const stateroomType = booking.stateroomType || '';
    const cabinType = STATEROOM_TYPE_MAP[stateroomType] || booking.cabinType || stateroomType || '';
    
    const stateroomNumber = booking.stateroomNumber || '';
    const cabinNumberOrGTY = stateroomNumber === 'GTY' ? 'GTY' : stateroomNumber;
    
    const bookingId = booking.bookingId || booking.masterBookingId || '';
    
    let status = booking.source || 'Upcoming';
    if (booking.bookingStatus === 'OF') status = 'Courtesy Hold';
    else if (booking.status) status = booking.status;
    
    const loyaltyLevel = loyaltyData?.crownAndAnchorLevel || '';
    const loyaltyPoints = loyaltyData?.crownAndAnchorPoints || '';

    const row = [
      escapeCSVField(status),
      escapeCSVField(shipName),
      escapeCSVField(sailDate),
      escapeCSVField(returnDate),
      escapeCSVField(sailingDates),
      escapeCSVField(itinerary),
      escapeCSVField(departurePort),
      escapeCSVField(cabinType),
      escapeCSVField(cabinNumberOrGTY),
      escapeCSVField(bookingId),
      escapeCSVField(status),
      escapeCSVField(loyaltyLevel),
      escapeCSVField(loyaltyPoints)
    ];

    rows.push(row.join(','));
  }

  console.log('[CSV Export] Generated', bookings.length, 'booking rows');
  return rows.join('\n');
}

window.exportToCSV = function(capturedData, includeOffers, includeBookings) {
  console.log('[CSV Export] Starting export with data:', {
    hasOffers: !!capturedData.offers,
    hasUpcomingCruises: !!capturedData.upcomingCruises,
    hasCourtesyHolds: !!capturedData.courtesyHolds,
    includeOffers,
    includeBookings
  });

  const loyaltyData = capturedData.loyalty?.payload?.loyaltyInformation || null;
  
  let csvContent = '';
  
  if (includeOffers && capturedData.offers) {
    const offersCSV = generateOffersCSV(capturedData.offers, loyaltyData);
    if (offersCSV) {
      csvContent += offersCSV;
    }
  }
  
  if (includeBookings) {
    const bookingsCSV = generateBookedCruisesCSV(capturedData, loyaltyData);
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
  const cruiseLine = capturedData.cruiseLine === 'celebrity' ? 'celebrity' : 'royal';
  const filename = `easy-seas-${cruiseLine}-offers-${timestamp}.csv`;
  
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
};
