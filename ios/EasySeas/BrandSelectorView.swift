import SwiftUI

struct BrandSelectorView: View {
    @Bindable var store: EasySeasStore

    var body: some View {
        HStack(spacing: 10) {
            ForEach(CruiseBrand.allCases) { brand in
                Button {
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.82)) {
                        store.selectedBrand = brand
                    }
                } label: {
                    BrandPill(brand: brand, isSelected: store.selectedBrand == brand)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .accessibilityElement(children: .contain)
    }
}
