import SwiftUI

struct OfferDetailScreen: View {
    @Bindable var store: EasySeasStore
    let offer: CruiseOffer

    private var offerSailings: [CruiseSailing] {
        store.sailings
            .filter { $0.brand == offer.brand && $0.offerCode.caseInsensitiveCompare(offer.code) == .orderedSame }
            .sorted { $0.sailDate < $1.sailDate }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard

                SectionHeader(title: "Eligible Sailings", subtitle: "Every imported sailing row assigned to this offer code.", systemImage: "list.bullet.rectangle.fill")

                ForEach(offerSailings) { sailing in
                    CruiseSailingCardView(sailing: sailing) {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                            store.book(sailing)
                        }
                    }
                }

                if offerSailings.isEmpty {
                    EmptyStateView(title: "No sailings captured", subtitle: "This mirrors the Expo sync state when Royal exposes an offer card but hides the sailing rows.", systemImage: "tray")
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 32)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle(offer.code)
        .toolbarTitleDisplayMode(.inline)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(offer.name)
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(offer.brand.programName)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(offer.brand.tint)
                }
                Spacer()
                Text(offer.status.uppercased())
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(EasySeasTheme.money, in: .capsule)
            }

            HStack(spacing: 10) {
                metric("Sailings", "\(offerSailings.count)", EasySeasTheme.aqua)
                metric("Trade-in", Formatters.dollars(offer.tradeInValue), EasySeasTheme.gold)
                metric("FreePlay", Formatters.dollars(offer.freePlay), EasySeasTheme.purple)
            }

            HStack(spacing: 10) {
                metric("OBC", Formatters.dollars(offer.onboardCredit), EasySeasTheme.money)
                metric("Expires", Formatters.shortDate.string(from: offer.expiresOn), offer.brand.tint)
            }

            FlowPills(items: offer.perks, tint: offer.brand.tint)
        }
        .padding(16)
        .background(EasySeasTheme.softCardGradient, in: .rect(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(offer.brand.tint.opacity(0.22), lineWidth: 1))
        .cardShadow()
    }

    private func metric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.headline.weight(.heavy))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.62)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.white.opacity(0.78), in: .rect(cornerRadius: 13))
    }
}
