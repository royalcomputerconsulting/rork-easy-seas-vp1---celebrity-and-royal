import SwiftUI

struct StatTile: View {
    let value: String
    let label: String
    var color: Color = EasySeasTheme.navy

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .foregroundStyle(color)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}
