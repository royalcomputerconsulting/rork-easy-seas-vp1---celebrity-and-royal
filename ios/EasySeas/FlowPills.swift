import SwiftUI

struct FlowPills: View {
    let items: [String]
    var tint: Color = EasySeasTheme.aqua

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 7)], alignment: .leading, spacing: 7) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(tint.opacity(0.10), in: .rect(cornerRadius: 10))
            }
        }
    }
}
