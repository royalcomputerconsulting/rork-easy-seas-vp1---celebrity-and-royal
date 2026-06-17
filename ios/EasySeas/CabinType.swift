import Foundation

nonisolated enum CabinType: String, CaseIterable, Codable, Hashable, Identifiable {
    case interior = "Interior"
    case oceanView = "Ocean View"
    case balcony = "Balcony"
    case suite = "Suite"

    var id: String { rawValue }
}
