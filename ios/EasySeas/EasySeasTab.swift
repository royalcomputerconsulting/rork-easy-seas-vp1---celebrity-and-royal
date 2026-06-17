import Foundation

nonisolated enum EasySeasTab: String, CaseIterable, Hashable {
    case offers
    case cruises
    case booked
    case calendar
    case casino
    case slots
    case settings

    var title: String {
        switch self {
        case .offers: "Offers"
        case .cruises: "Cruises"
        case .booked: "Booked"
        case .calendar: "Calendar"
        case .casino: "Casino"
        case .slots: "Slots"
        case .settings: "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .offers: "tag.fill"
        case .cruises: "calendar.badge.clock"
        case .booked: "ferry.fill"
        case .calendar: "party.popper.fill"
        case .casino: "chart.line.uptrend.xyaxis"
        case .slots: "gamecontroller.fill"
        case .settings: "gearshape.fill"
        }
    }
}
