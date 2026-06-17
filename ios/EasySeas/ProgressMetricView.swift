import SwiftUI

struct ProgressMetricView: View {
    let title: String
    let detail: String
    let progress: Double
    var tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(EasySeasTheme.navy)
                Spacer()
                Text("\(Int(progress * 100))%")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(tint)
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(tint.opacity(0.14))
                    Capsule()
                        .fill(LinearGradient(colors: [tint, EasySeasTheme.gold], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(8, proxy.size.width * min(max(progress, 0), 1)))
                }
            }
            .frame(height: 8)

            Text(detail)
                .font(.caption2)
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
    }
}
