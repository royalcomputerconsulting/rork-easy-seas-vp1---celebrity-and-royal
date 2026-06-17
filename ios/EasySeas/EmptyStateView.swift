import SwiftUI

struct EmptyStateView: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(EasySeasTheme.aqua)
                .frame(width: 72, height: 72)
                .background(EasySeasTheme.aqua.opacity(0.10), in: .circle)
            Text(title)
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
    }
}
