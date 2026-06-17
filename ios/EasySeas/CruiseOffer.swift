import Foundation

nonisolated struct CruiseOffer: Identifiable, Codable, Hashable {
    let id: UUID
    var brand: CruiseBrand
    var code: String
    var name: String
    var expiresOn: Date
    var tradeInValue: Double
    var onboardCredit: Double
    var freePlay: Double
    var perks: [String]
    var status: String

    init(id: UUID = UUID(), brand: CruiseBrand, code: String, name: String, expiresOn: Date, tradeInValue: Double, onboardCredit: Double, freePlay: Double, perks: [String], status: String = "Active") {
        self.id = id
        self.brand = brand
        self.code = code
        self.name = name
        self.expiresOn = expiresOn
        self.tradeInValue = tradeInValue
        self.onboardCredit = onboardCredit
        self.freePlay = freePlay
        self.perks = perks
        self.status = status
    }
}
