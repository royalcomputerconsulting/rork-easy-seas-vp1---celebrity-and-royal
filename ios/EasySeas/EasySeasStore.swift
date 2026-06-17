import Foundation
import Observation

@Observable
final class EasySeasStore {
    private static let storageKey: String = "easy-seas-native-store-v1"

    var selectedBrand: CruiseBrand = .royalCaribbean
    var searchText: String = ""
    var offers: [CruiseOffer]
    var sailings: [CruiseSailing]
    var bookedCruises: [BookedCruise]
    var calendarEvents: [CalendarEventItem]
    var slotMachines: [SlotMachine]
    var syncLogs: [SyncLogEntry]
    var clubRoyalePoints: Int = 58_680
    var crownAnchorPoints: Int = 392
    var memberEmail: String = "captain@easy-seas.com"
    var isSyncing: Bool = false
    var lastSyncSummary: String = "Ready to sync Royal Caribbean or Celebrity offers, booked cruises, loyalty, and completed cruise history."

    init() {
        if let snapshot = Self.loadSnapshot() {
            self.selectedBrand = snapshot.selectedBrand
            self.offers = snapshot.offers
            self.sailings = snapshot.sailings
            self.bookedCruises = snapshot.bookedCruises
            self.calendarEvents = snapshot.calendarEvents
            self.slotMachines = snapshot.slotMachines
            self.syncLogs = snapshot.syncLogs.isEmpty ? [SyncLogEntry(kind: .info, message: "Native iOS data restored")] : snapshot.syncLogs
            self.clubRoyalePoints = snapshot.clubRoyalePoints
            self.crownAnchorPoints = snapshot.crownAnchorPoints
            self.memberEmail = snapshot.memberEmail
            self.lastSyncSummary = snapshot.lastSyncSummary
        } else {
            self.offers = SampleData.offers
            self.sailings = SampleData.sailings
            self.bookedCruises = SampleData.bookedCruises
            self.calendarEvents = SampleData.calendarEvents
            self.slotMachines = SampleData.slotMachines
            self.syncLogs = [
                SyncLogEntry(kind: .info, message: "Native iOS shell initialized"),
                SyncLogEntry(kind: .success, message: "Loaded sample offers, sailings, bookings, casino portfolio, and slot atlas")
            ]
            persist()
        }
    }

    var activeOffers: [CruiseOffer] {
        offers.filter { $0.status == "Active" && $0.brand == selectedBrand }
    }

    var upcomingSailings: [CruiseSailing] {
        sailings
            .filter { $0.brand == selectedBrand && $0.sailDate >= Date() }
            .sorted { $0.sailDate < $1.sailDate }
    }

    var selectedBookedCruises: [BookedCruise] {
        bookedCruises
            .filter { $0.brand == selectedBrand }
            .sorted { $0.sailDate < $1.sailDate }
    }

    var upcomingBookedCruises: [BookedCruise] {
        selectedBookedCruises.filter { !$0.isCompleted }
    }

    var completedBookedCruises: [BookedCruise] {
        selectedBookedCruises.filter { $0.isCompleted }
    }

    var totalRetailValue: Double {
        bookedCruises.reduce(0) { $0 + $1.retailValue }
    }

    var totalPaid: Double {
        bookedCruises.reduce(0) { $0 + $1.totalPaid }
    }

    var totalEconomicValue: Double {
        max(0, totalRetailValue - totalPaid)
    }

    var averageValuePerCruise: Double {
        guard !bookedCruises.isEmpty else { return 0 }
        return totalEconomicValue / Double(bookedCruises.count)
    }

    var importedSailingCountByOffer: [String: Int] {
        Dictionary(grouping: sailings) { sailing in
            sailing.offerCode.uppercased()
        }
        .mapValues { groupedSailings in
            groupedSailings.count
        }
    }

    var dataHealthFindings: [String] {
        var findings: [String] = []
        let orphanedSailings = sailings.filter { sailing in !offers.contains { $0.code.caseInsensitiveCompare(sailing.offerCode) == .orderedSame } }
        let orphanedBookings = bookedCruises.filter { booking in !offers.contains { $0.code.caseInsensitiveCompare(booking.offerCode) == .orderedSame } }
        if orphanedSailings.isEmpty {
            findings.append("Every sailing is linked to a known offer code.")
        } else {
            findings.append("\(orphanedSailings.count) sailing(s) need offer-code review.")
        }
        if orphanedBookings.isEmpty {
            findings.append("Booked cruises are linked to imported offers where possible.")
        } else {
            findings.append("\(orphanedBookings.count) booked cruise(s) use historical or unmatched offer codes.")
        }
        findings.append("Date windows are stored as native Date values for conflict checks and completed/upcoming status.")
        findings.append("Sync summaries include offer names and sailing counts per offer.")
        return findings
    }

    var filteredSlotMachines: [SlotMachine] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if query.isEmpty { return slotMachines }
        return slotMachines.filter { machine in
            machine.name.lowercased().contains(query) ||
            machine.manufacturer.lowercased().contains(query) ||
            machine.shipsSeen.joined(separator: " ").lowercased().contains(query)
        }
    }

    func setSelectedBrand(_ brand: CruiseBrand) {
        selectedBrand = brand
        persist()
    }

    func toggleFavorite(machine: SlotMachine) {
        guard let index = slotMachines.firstIndex(where: { $0.id == machine.id }) else { return }
        slotMachines[index].isFavorite.toggle()
        persist()
    }

    func updateProfile(email: String, clubRoyale: Int, crownAnchor: Int) {
        memberEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? memberEmail : email.trimmingCharacters(in: .whitespacesAndNewlines)
        clubRoyalePoints = max(0, clubRoyale)
        crownAnchorPoints = max(0, crownAnchor)
        syncLogs.append(SyncLogEntry(kind: .success, message: "Profile and loyalty baselines updated"))
        persist()
    }

    func book(_ sailing: CruiseSailing) {
        let booking = BookedCruise(
            brand: sailing.brand,
            reservationNumber: "ES\(Int.random(in: 43000...98999))",
            shipName: sailing.shipName,
            itineraryName: sailing.itineraryName,
            departurePort: sailing.departurePort,
            sailDate: sailing.sailDate,
            returnDate: sailing.returnDate,
            nights: sailing.nights,
            offerCode: sailing.offerCode,
            casinoPoints: 0,
            totalPaid: sailing.taxesFees,
            retailValue: sailing.retailValue,
            status: "Upcoming"
        )
        guard !bookedCruises.contains(where: { existing in
            existing.brand == sailing.brand && existing.shipName == sailing.shipName && Calendar.current.isDate(existing.sailDate, inSameDayAs: sailing.sailDate)
        }) else {
            syncLogs.append(SyncLogEntry(kind: .info, message: "\(sailing.shipName) is already in Booked"))
            persist()
            return
        }
        bookedCruises.append(booking)
        calendarEvents.append(CalendarEventItem(title: sailing.shipName, subtitle: sailing.itineraryName, date: sailing.sailDate, kind: "Cruise", brand: sailing.brand))
        syncLogs.append(SyncLogEntry(kind: .success, message: "Booked \(sailing.shipName) from offer \(sailing.offerCode)"))
        persist()
    }

    func applyImportReview() {
        let importedCodes = Set(offers.map { $0.code.uppercased() })
        let missingCelebrityOffer = CruiseOffer(brand: .celebrity, code: "26WCR403", name: "Blue Chip Caribbean Showcase", expiresOn: DateBuilder.date(2026, 12, 31), tradeInValue: 1_100, onboardCredit: 200, freePlay: 300, perks: ["Veranda eligible", "Winter sailings"], status: "Active")
        if !importedCodes.contains(missingCelebrityOffer.code) {
            offers.append(missingCelebrityOffer)
            sailings.append(CruiseSailing(brand: .celebrity, offerCode: missingCelebrityOffer.code, shipName: "Celebrity Apex", itineraryName: "Key West & Bahamas", destination: "Bahamas", departurePort: "Fort Lauderdale", sailDate: DateBuilder.date(2026, 11, 8), returnDate: DateBuilder.date(2026, 11, 15), nights: 7, cabinType: .balcony, taxesFees: 266, retailValue: 4_650, tags: ["Imported review", "Veranda"]))
        }
        lastSyncSummary = buildSyncSummary()
        syncLogs.append(SyncLogEntry(kind: .success, message: "Import review applied — assignments merged without duplicates"))
        persist()
    }

    func resetToSampleData() {
        selectedBrand = .royalCaribbean
        offers = SampleData.offers
        sailings = SampleData.sailings
        bookedCruises = SampleData.bookedCruises
        calendarEvents = SampleData.calendarEvents
        slotMachines = SampleData.slotMachines
        clubRoyalePoints = 58_680
        crownAnchorPoints = 392
        memberEmail = "captain@easy-seas.com"
        lastSyncSummary = "Ready to sync Royal Caribbean or Celebrity offers, booked cruises, loyalty, and completed cruise history."
        syncLogs = [SyncLogEntry(kind: .info, message: "Reset native app data to Easy Seas sample baseline")]
        persist()
    }

    func runDemoSync() async {
        guard !isSyncing else { return }
        isSyncing = true
        syncLogs.append(SyncLogEntry(kind: .step, message: "Opening \(selectedBrand.title) account session"))
        try? await Task.sleep(for: .milliseconds(420))
        syncLogs.append(SyncLogEntry(kind: .step, message: "Capturing casino offers and every sailing row per offer"))
        try? await Task.sleep(for: .milliseconds(480))
        syncLogs.append(SyncLogEntry(kind: .step, message: "Merging booked, upcoming, loyalty, and completed cruise history"))
        try? await Task.sleep(for: .milliseconds(520))

        lastSyncSummary = buildSyncSummary()
        syncLogs.append(SyncLogEntry(kind: .success, message: "Final sync complete — \(activeOffers.count) offers, \(upcomingSailings.count) sailings, \(upcomingBookedCruises.count) upcoming, \(completedBookedCruises.count) completed"))
        isSyncing = false
        persist()
    }

    func buildSyncSummary() -> String {
        let summaryLines = activeOffers.map { offer in
            let count = sailings.filter { $0.brand == selectedBrand && $0.offerCode.caseInsensitiveCompare(offer.code) == .orderedSame }.count
            return "• \(offer.name) (\(offer.code)): \(count) cruise(s)"
        }
        return "Synced \(activeOffers.count) offer(s), \(upcomingSailings.count) eligible sailing(s), \(upcomingBookedCruises.count) upcoming booking(s), and \(completedBookedCruises.count) completed cruise(s).\n" + summaryLines.joined(separator: "\n")
    }

    private static func loadSnapshot() -> EasySeasSnapshot? {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else { return nil }
        return try? JSONDecoder().decode(EasySeasSnapshot.self, from: data)
    }

    private func persist() {
        let snapshot = EasySeasSnapshot(selectedBrand: selectedBrand, offers: offers, sailings: sailings, bookedCruises: bookedCruises, calendarEvents: calendarEvents, slotMachines: slotMachines, syncLogs: syncLogs, clubRoyalePoints: clubRoyalePoints, crownAnchorPoints: crownAnchorPoints, memberEmail: memberEmail, lastSyncSummary: lastSyncSummary)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: Self.storageKey)
    }
}
