import Foundation

enum SampleData {
    static let offers: [CruiseOffer] = [
        CruiseOffer(brand: .royalCaribbean, code: "2605C03A", name: "May Jackpot Getaway", expiresOn: DateBuilder.date(2026, 8, 31), tradeInValue: 1_200, onboardCredit: 250, freePlay: 400, perks: ["Balcony eligible", "Taxes only", "Companion fare"]),
        CruiseOffer(brand: .royalCaribbean, code: "26BCP105", name: "Limitless Luck", expiresOn: DateBuilder.date(2026, 9, 15), tradeInValue: 950, onboardCredit: 100, freePlay: 250, perks: ["Interior to balcony", "Select sailings"]),
        CruiseOffer(brand: .royalCaribbean, code: "26JUL104", name: "Summer Casino Preview", expiresOn: DateBuilder.date(2026, 10, 4), tradeInValue: 700, onboardCredit: 75, freePlay: 150, perks: ["Short getaways", "Flexible ports"]),
        CruiseOffer(brand: .celebrity, code: "26TOC208", name: "Blue Chip Mediterranean", expiresOn: DateBuilder.date(2026, 11, 20), tradeInValue: 1_500, onboardCredit: 300, freePlay: 500, perks: ["Ocean View+", "Premium itinerary"])
    ]

    static let sailings: [CruiseSailing] = [
        CruiseSailing(brand: .royalCaribbean, offerCode: "2605C03A", shipName: "Utopia of the Seas", itineraryName: "Bahamas Perfect Day", destination: "Bahamas", departurePort: "Port Canaveral", sailDate: DateBuilder.date(2026, 7, 10), returnDate: DateBuilder.date(2026, 7, 14), nights: 4, cabinType: .balcony, taxesFees: 186, retailValue: 2_430, tags: ["Perfect Day", "No conflict"]),
        CruiseSailing(brand: .royalCaribbean, offerCode: "2605C03A", shipName: "Wonder of the Seas", itineraryName: "Eastern Caribbean", destination: "St. Maarten • St. Thomas", departurePort: "Miami", sailDate: DateBuilder.date(2026, 8, 2), returnDate: DateBuilder.date(2026, 8, 9), nights: 7, cabinType: .oceanView, taxesFees: 241, retailValue: 3_860, tags: ["High value", "7 nights"]),
        CruiseSailing(brand: .royalCaribbean, offerCode: "26BCP105", shipName: "Navigator of the Seas", itineraryName: "Catalina & Ensenada", destination: "Mexico", departurePort: "Los Angeles", sailDate: DateBuilder.date(2026, 9, 18), returnDate: DateBuilder.date(2026, 9, 22), nights: 4, cabinType: .interior, taxesFees: 138, retailValue: 1_780, tags: ["West Coast"]),
        CruiseSailing(brand: .royalCaribbean, offerCode: "26JUL104", shipName: "Harmony of the Seas", itineraryName: "Western Caribbean", destination: "Cozumel • Costa Maya", departurePort: "Galveston", sailDate: DateBuilder.date(2026, 10, 11), returnDate: DateBuilder.date(2026, 10, 18), nights: 7, cabinType: .suite, taxesFees: 312, retailValue: 5_950, tags: ["Suite watch", "Family friendly"]),
        CruiseSailing(brand: .celebrity, offerCode: "26TOC208", shipName: "Celebrity Ascent", itineraryName: "Italy, Greece & Turkey", destination: "Mediterranean", departurePort: "Rome", sailDate: DateBuilder.date(2026, 9, 7), returnDate: DateBuilder.date(2026, 9, 18), nights: 11, cabinType: .balcony, taxesFees: 404, retailValue: 7_250, tags: ["Premium", "Long itinerary"]),
        CruiseSailing(brand: .celebrity, offerCode: "26TOC208", shipName: "Celebrity Xcel", itineraryName: "Caribbean Preview", destination: "Caribbean", departurePort: "Fort Lauderdale", sailDate: DateBuilder.date(2026, 12, 4), returnDate: DateBuilder.date(2026, 12, 11), nights: 7, cabinType: .oceanView, taxesFees: 288, retailValue: 4_800, tags: ["New ship"])
    ]

    static let bookedCruises: [BookedCruise] = [
        BookedCruise(brand: .royalCaribbean, reservationNumber: "4892371", shipName: "Ovation of the Seas", itineraryName: "Alaska Glacier Experience", departurePort: "Seattle", sailDate: DateBuilder.date(2026, 6, 26), returnDate: DateBuilder.date(2026, 7, 3), nights: 7, offerCode: "26BCP105", casinoPoints: 0, totalPaid: 226, retailValue: 4_120),
        BookedCruise(brand: .royalCaribbean, reservationNumber: "3158840", shipName: "Icon of the Seas", itineraryName: "Eastern Caribbean", departurePort: "Miami", sailDate: DateBuilder.date(2026, 11, 21), returnDate: DateBuilder.date(2026, 11, 28), nights: 7, offerCode: "2605C03A", casinoPoints: 0, totalPaid: 311, retailValue: 5_840),
        BookedCruise(brand: .royalCaribbean, reservationNumber: "2025499", shipName: "Harmony of the Seas", itineraryName: "Western Caribbean", departurePort: "Galveston", sailDate: DateBuilder.date(2025, 12, 14), returnDate: DateBuilder.date(2025, 12, 21), nights: 7, offerCode: "25HOL777", casinoPoints: 9_840, totalPaid: 289, retailValue: 3_940, status: "Completed"),
        BookedCruise(brand: .celebrity, reservationNumber: "CX92013", shipName: "Celebrity Beyond", itineraryName: "ABC Islands", departurePort: "Fort Lauderdale", sailDate: DateBuilder.date(2026, 8, 16), returnDate: DateBuilder.date(2026, 8, 25), nights: 9, offerCode: "26TOC208", casinoPoints: 0, totalPaid: 372, retailValue: 5_610)
    ]

    static let calendarEvents: [CalendarEventItem] = [
        CalendarEventItem(title: "Ovation of the Seas", subtitle: "Alaska Glacier Experience", date: DateBuilder.date(2026, 6, 26), kind: "Cruise", brand: .royalCaribbean),
        CalendarEventItem(title: "Offer deadline", subtitle: "May Jackpot Getaway expires", date: DateBuilder.date(2026, 8, 31), kind: "Offer", brand: .royalCaribbean),
        CalendarEventItem(title: "Celebrity Beyond", subtitle: "ABC Islands", date: DateBuilder.date(2026, 8, 16), kind: "Cruise", brand: .celebrity)
    ]

    static let slotMachines: [SlotMachine] = [
        SlotMachine(name: "Dragon Link", manufacturer: "Aristocrat", volatility: "High", denominations: ["1¢", "2¢", "5¢"], shipsSeen: ["Wonder", "Icon", "Utopia"], isFavorite: true),
        SlotMachine(name: "Lightning Link", manufacturer: "Aristocrat", volatility: "High", denominations: ["1¢", "5¢"], shipsSeen: ["Harmony", "Navigator"]),
        SlotMachine(name: "Buffalo Gold", manufacturer: "Aristocrat", volatility: "Medium", denominations: ["1¢", "2¢"], shipsSeen: ["Ovation", "Wonder"]),
        SlotMachine(name: "Dancing Drums", manufacturer: "SG Gaming", volatility: "Medium", denominations: ["1¢", "5¢"], shipsSeen: ["Celebrity Ascent", "Celebrity Beyond"]),
        SlotMachine(name: "Huff N More Puff", manufacturer: "Light & Wonder", volatility: "High", denominations: ["1¢"], shipsSeen: ["Icon", "Utopia"])
    ]
}
