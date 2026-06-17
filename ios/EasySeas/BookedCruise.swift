import Foundation

nonisolated struct BookedCruise: Identifiable, Codable, Hashable {
    let id: UUID
    var brand: CruiseBrand
    var reservationNumber: String
    var shipName: String
    var itineraryName: String
    var departurePort: String
    var sailDate: Date
    var returnDate: Date
    var nights: Int
    var offerCode: String
    var casinoPoints: Int
    var totalPaid: Double
    var retailValue: Double
    var status: String

    var isCompleted: Bool {
        returnDate < Date()
    }

    init(id: UUID = UUID(), brand: CruiseBrand, reservationNumber: String, shipName: String, itineraryName: String, departurePort: String, sailDate: Date, returnDate: Date, nights: Int, offerCode: String, casinoPoints: Int, totalPaid: Double, retailValue: Double, status: String = "Upcoming") {
        self.id = id
        self.brand = brand
        self.reservationNumber = reservationNumber
        self.shipName = shipName
        self.itineraryName = itineraryName
        self.departurePort = departurePort
        self.sailDate = sailDate
        self.returnDate = returnDate
        self.nights = nights
        self.offerCode = offerCode
        self.casinoPoints = casinoPoints
        self.totalPaid = totalPaid
        self.retailValue = retailValue
        self.status = status
    }
}
