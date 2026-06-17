import Foundation

nonisolated struct CalendarEventItem: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var subtitle: String
    var date: Date
    var kind: String
    var brand: CruiseBrand?

    init(id: UUID = UUID(), title: String, subtitle: String, date: Date, kind: String, brand: CruiseBrand? = nil) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.date = date
        self.kind = kind
        self.brand = brand
    }
}
