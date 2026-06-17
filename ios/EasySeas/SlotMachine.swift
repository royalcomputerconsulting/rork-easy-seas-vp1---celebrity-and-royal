import Foundation

nonisolated struct SlotMachine: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var manufacturer: String
    var volatility: String
    var denominations: [String]
    var shipsSeen: [String]
    var isFavorite: Bool

    init(id: UUID = UUID(), name: String, manufacturer: String, volatility: String, denominations: [String], shipsSeen: [String], isFavorite: Bool = false) {
        self.id = id
        self.name = name
        self.manufacturer = manufacturer
        self.volatility = volatility
        self.denominations = denominations
        self.shipsSeen = shipsSeen
        self.isFavorite = isFavorite
    }
}
