import Foundation

nonisolated enum DateBuilder {
    static func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        let calendar = Calendar(identifier: .gregorian)
        let components = DateComponents(calendar: calendar, timeZone: TimeZone(secondsFromGMT: 0), year: year, month: month, day: day)
        return components.date ?? Date()
    }

    static func plusDays(_ days: Int, from date: Date) -> Date {
        Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: date) ?? date
    }
}
