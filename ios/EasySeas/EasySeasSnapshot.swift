import Foundation

nonisolated struct EasySeasSnapshot: Codable {
    var selectedBrand: CruiseBrand
    var offers: [CruiseOffer]
    var sailings: [CruiseSailing]
    var bookedCruises: [BookedCruise]
    var calendarEvents: [CalendarEventItem]
    var slotMachines: [SlotMachine]
    var syncLogs: [SyncLogEntry]
    var clubRoyalePoints: Int
    var crownAnchorPoints: Int
    var memberEmail: String
    var lastSyncSummary: String
}
