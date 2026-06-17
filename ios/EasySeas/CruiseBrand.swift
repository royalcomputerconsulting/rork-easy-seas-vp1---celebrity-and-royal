import SwiftUI

nonisolated enum CruiseBrand: String, CaseIterable, Codable, Hashable, Identifiable {
    case royalCaribbean
    case celebrity

    var id: String { rawValue }

    var title: String {
        switch self {
        case .royalCaribbean: "Royal Caribbean"
        case .celebrity: "Celebrity Cruises"
        }
    }

    var shortTitle: String {
        switch self {
        case .royalCaribbean: "Royal"
        case .celebrity: "Celebrity"
        }
    }

    var programName: String {
        switch self {
        case .royalCaribbean: "Club Royale"
        case .celebrity: "Blue Chip Club"
        }
    }

    @MainActor var tint: Color {
        switch self {
        case .royalCaribbean: EasySeasTheme.aqua
        case .celebrity: EasySeasTheme.seafoam
        }
    }
}
