import SwiftUI

struct OffersScreen: View {
    @Bindable var store: EasySeasStore

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    DashboardHeroView(store: store)
                    BrandSelectorView(store: store)
                    SectionHeader(title: "Active Casino Offers", subtitle: "Grouped by offer code with every eligible sailing counted.", systemImage: "tag.fill")

                    ForEach(store.activeOffers) { offer in
                        NavigationLink {
                            OfferDetailScreen(store: store, offer: offer)
                        } label: {
                            OfferCardView(
                                offer: offer,
                                sailingCount: store.sailings.filter { $0.brand == store.selectedBrand && $0.offerCode.caseInsensitiveCompare(offer.code) == .orderedSame }.count
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    if store.activeOffers.isEmpty {
                        EmptyStateView(title: "No active offers", subtitle: "Run Sync Now from Settings to import casino offers.", systemImage: "tray")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Offers")
            .toolbarTitleDisplayMode(.large)
        }
    }
}
