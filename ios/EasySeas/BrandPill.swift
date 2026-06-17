import SwiftUI

struct BrandPill: View {
    let brand: CruiseBrand
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: brand == .royalCaribbean ? "anchor" : "sparkles")
                .font(.caption.weight(.bold))
            Text(brand.shortTitle)
                .font(.caption.weight(.bold))
        }
        .foregroundStyle(isSelected ? .white : brand.tint)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isSelected ? brand.tint : brand.tint.opacity(0.12), in: .capsule)
        .accessibilityLabel(brand.title)
    }
}
