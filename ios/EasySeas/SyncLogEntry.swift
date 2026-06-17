import Foundation

nonisolated struct SyncLogEntry: Identifiable, Codable, Hashable {
    enum Kind: String, Codable, Hashable {
        case info
        case step
        case success
        case warning
    }

    let id: UUID
    var timestamp: Date
    var kind: Kind
    var message: String

    init(id: UUID = UUID(), timestamp: Date = Date(), kind: Kind, message: String) {
        self.id = id
        self.timestamp = timestamp
        self.kind = kind
        self.message = message
    }
}
