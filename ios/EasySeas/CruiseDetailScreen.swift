import SwiftUI

struct CruiseDetailScreen: View {
    @Bindable var store: EasySeasStore
    let sailing: CruiseSailing

    private var matchingOffer: CruiseOffer? {
        store.offers.first { $0.brand == sailing.brand && $0.code.caseInsensitiveCompare(sailing.offerCode) == .orderedSame }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                valueCard
                if let matchingOffer {
                    NavigationLink {
                        OfferDetailScreen(store: store, offer: matchingOffer)
                    } label: {
                        relatedOfferCard(matchingOffer)
                    }
                    .buttonStyle(.plain)
                }
                PrimaryButton(title: "Mark as Booked", systemImage: "checkmark.seal.fill") {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        store.book(sailing)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 32)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle(sailing.shipName)
        .toolbarTitleDisplayMode(.inline)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(sailing.shipName)
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(sailing.itineraryName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                Text("\(sailing.nights)n")
                    .font(.title.weight(.heavy))
                    .foregroundStyle(sailing.brand.tint)
            }
            FlowPills(items: [sailing.brand.shortTitle, sailing.offerCode, sailing.cabinType.rawValue] + sailing.tags, tint: sailing.brand.tint)
            HStack(spacing: 10) {
                metric("Sails", Formatters.shortDate.string(from: sailing.sailDate), EasySeasTheme.aqua)
                metric("Returns", Formatters.shortDate.string(from: sailing.returnDate), EasySeasTheme.purple)
            }
            HStack(spacing: 10) {
                metric("Port", sailing.departurePort, sailing.brand.tint)
                metric("Destination", sailing.destination, EasySeasTheme.gold)
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(sailing.brand.tint.opacity(0.2), lineWidth: 1))
        .cardShadow()
    }

    private var valueCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Value Stack", subtitle: "Taxes-only cost, retail comparison, and estimated captured value.", systemImage: "dollarsign.circle.fill")
            HStack(spacing: 10) {
                metric("Taxes & fees", Formatters.dollars(sailing.taxesFees), EasySeasTheme.money)
                metric("Retail value", Formatters.dollars(sailing.retailValue), EasySeasTheme.gold)
                metric("Net value", Formatters.dollars(max(0, sailing.retailValue - sailing.taxesFees)), EasySeasTheme.purple)
            }
        }
        .padding(16)
        .background(EasySeasTheme.softCardGradient, in: .rect(cornerRadius: 22))
    }

    private func relatedOfferCard(_ offer: CruiseOffer) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "tag.fill")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 42, height: 42)
                .background(offer.brand.tint, in: .circle)
            VStack(alignment: .leading, spacing: 3) {
                Text("Related Offer")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(EasySeasTheme.textSecondary)
                Text("\(offer.name) • \(offer.code)")
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18))
    }

    private func metric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.58)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.white.opacity(0.78), in: .rect(cornerRadius: 13))
    }
}
