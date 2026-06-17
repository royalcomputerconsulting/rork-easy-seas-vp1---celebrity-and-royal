import Foundation
import Observation

@Observable
final class EasySeasStore {
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
        self.offers = SampleData.offers
        self.sailings = SampleData.sailings
        self.bookedCruises = SampleData.bookedCruises
        self.calendarEvents = SampleData.calendarEvents
        self.slotMachines = SampleData.slotMachines
        self.syncLogs = [
            SyncLogEntry(kind: .info, message: "Native iOS shell initialized"),
            SyncLogEntry(kind: .success, message: "Loaded sample offers, sailings, bookings, casino portfolio, and slot atlas")
        ]
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

    var filteredSlotMachines: [SlotMachine] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if query.isEmpty { return slotMachines }
        return slotMachines.filter { machine in
            machine.name.lowercased().contains(query) ||
            machine.manufacturer.lowercased().contains(query) ||
            machine.shipsSeen.joined(separator: " ").lowercased().contains(query)
        }
    }

    func toggleFavorite(machine: SlotMachine) {
        guard let index = slotMachines.firstIndex(where: { $0.id == machine.id }) else { return }
        slotMachines[index].isFavorite.toggle()
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
        bookedCruises.append(booking)
        calendarEvents.append(CalendarEventItem(title: sailing.shipName, subtitle: sailing.itineraryName, date: sailing.sailDate, kind: "Cruise", brand: sailing.brand))
        syncLogs.append(SyncLogEntry(kind: .success, message: "Booked \(sailing.shipName) from offer \(sailing.offerCode)"))
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

        let summaryLines = activeOffers.map { offer in
            let count = sailings.filter { $0.brand == selectedBrand && $0.offerCode == offer.code }.count
            return "• \(offer.name) (\(offer.code)): \(count) cruise(s)"
        }
        let upcomingCount = upcomingBookedCruises.count
        let completedCount = completedBookedCruises.count
        lastSyncSummary = "Synced \(activeOffers.count) offer(s), \(upcomingSailings.count) eligible sailing(s), \(upcomingCount) upcoming booking(s), and \(completedCount) completed cruise(s).\n" + summaryLines.joined(separator: "\n")
        syncLogs.append(SyncLogEntry(kind: .success, message: "Final sync complete — \(activeOffers.count) offers, \(upcomingSailings.count) sailings, \(upcomingCount) upcoming, \(completedCount) completed"))
        isSyncing = false
    }
}
