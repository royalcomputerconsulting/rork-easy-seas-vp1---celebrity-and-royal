import SwiftUI

struct CalendarEventRow: View {
    let event: CalendarEventItem

    var body: some View {
        HStack(spacing: 13) {
            VStack(spacing: 2) {
                Text(Formatters.monthDay.string(from: event.date).split(separator: " ").first.map(String.init) ?? "")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(EasySeasTheme.textSecondary)
                Text(Formatters.monthDay.string(from: event.date).split(separator: " ").last.map(String.init) ?? "")
                    .font(.title3.weight(.heavy))
                    .foregroundStyle(event.brand?.tint ?? EasySeasTheme.gold)
            }
            .frame(width: 48, height: 56)
            .background((event.brand?.tint ?? EasySeasTheme.gold).opacity(0.10), in: .rect(cornerRadius: 14))

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Text(event.subtitle)
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
            Text(event.kind)
                .font(.caption2.weight(.heavy))
                .foregroundStyle(event.brand?.tint ?? EasySeasTheme.gold)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background((event.brand?.tint ?? EasySeasTheme.gold).opacity(0.10), in: .capsule)
        }
        .padding(12)
        .background(.white, in: .rect(cornerRadius: 18))
    }
}
