import SwiftUI

struct BookedCruiseDetailScreen: View {
    let cruise: BookedCruise

    private var netValue: Double { max(0, cruise.retailValue - cruise.totalPaid) }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(cruise.shipName)
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(EasySeasTheme.navy)
                            Text(cruise.itineraryName)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EasySeasTheme.textSecondary)
                        }
                        Spacer()
                        Text(cruise.isCompleted ? "Completed" : "Upcoming")
                            .font(.caption2.weight(.heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(cruise.isCompleted ? EasySeasTheme.textSecondary : EasySeasTheme.money, in: .capsule)
                    }
                    FlowPills(items: [cruise.brand.shortTitle, cruise.offerCode, "Res \(cruise.reservationNumber)", "\(cruise.nights) nights"], tint: cruise.brand.tint)
                }
                .padding(16)
                .background(.white, in: .rect(cornerRadius: 22))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(cruise.brand.tint.opacity(0.2), lineWidth: 1))
                .cardShadow()

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(title: "Cruise Ledger", subtitle: "The same booked-cruise context used by Casino and Calendar.", systemImage: "doc.text.fill")
                    HStack(spacing: 10) {
                        metric("Sails", Formatters.shortDate.string(from: cruise.sailDate), EasySeasTheme.aqua)
                        metric("Returns", Formatters.shortDate.string(from: cruise.returnDate), EasySeasTheme.purple)
                    }
                    HStack(spacing: 10) {
                        metric("Paid", Formatters.dollars(cruise.totalPaid), EasySeasTheme.money)
                        metric("Retail", Formatters.dollars(cruise.retailValue), EasySeasTheme.gold)
                        metric("Net", Formatters.dollars(netValue), EasySeasTheme.purple)
                    }
                    HStack(spacing: 10) {
                        metric("Casino pts", cruise.casinoPoints.formatted(), EasySeasTheme.aqua)
                        metric("Port", cruise.departurePort, cruise.brand.tint)
                    }
                }
                .padding(16)
                .background(EasySeasTheme.softCardGradient, in: .rect(cornerRadius: 22))
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 32)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle(cruise.reservationNumber)
        .toolbarTitleDisplayMode(.inline)
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
