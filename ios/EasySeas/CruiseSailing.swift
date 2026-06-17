import Foundation

nonisolated struct CruiseSailing: Identifiable, Codable, Hashable {
    let id: UUID
    var brand: CruiseBrand
    var offerCode: String
    var shipName: String
    var itineraryName: String
    var destination: String
    var departurePort: String
    var sailDate: Date
    var returnDate: Date
    var nights: Int
    var cabinType: CabinType
    var taxesFees: Double
    var retailValue: Double
    var tags: [String]

    init(id: UUID = UUID(), brand: CruiseBrand, offerCode: String, shipName: String, itineraryName: String, destination: String, departurePort: String, sailDate: Date, returnDate: Date, nights: Int, cabinType: CabinType, taxesFees: Double, retailValue: Double, tags: [String] = []) {
        self.id = id
        self.brand = brand
        self.offerCode = offerCode
        self.shipName = shipName
        self.itineraryName = itineraryName
        self.destination = destination
        self.departurePort = departurePort
        self.sailDate = sailDate
        self.returnDate = returnDate
        self.nights = nights
        self.cabinType = cabinType
        self.taxesFees = taxesFees
        self.retailValue = retailValue
        self.tags = tags
    }
}
