import SwiftUI

struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var systemImage: String? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.headline)
                    .foregroundStyle(EasySeasTheme.gold)
                    .frame(width: 28, height: 28)
                    .background(EasySeasTheme.gold.opacity(0.14), in: .circle)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }
            Spacer()
        }
    }
}
