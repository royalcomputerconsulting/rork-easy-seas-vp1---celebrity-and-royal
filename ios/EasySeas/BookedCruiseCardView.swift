import SwiftUI

struct BookedCruiseCardView: View {
    let cruise: BookedCruise

    private var statusColor: Color {
        cruise.isCompleted ? EasySeasTheme.textSecondary : EasySeasTheme.money
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(cruise.shipName)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(cruise.itineraryName)
                        .font(.subheadline)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                Text(cruise.isCompleted ? "Completed" : "Upcoming")
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(statusColor, in: .capsule)
            }

            HStack(spacing: 10) {
                Label("\(Formatters.monthDay.string(from: cruise.sailDate))–\(Formatters.monthDay.string(from: cruise.returnDate))", systemImage: "calendar")
                Label(cruise.departurePort, systemImage: "location.fill")
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(EasySeasTheme.textSecondary)

            HStack(spacing: 10) {
                miniStat("Res", cruise.reservationNumber, EasySeasTheme.navy)
                miniStat("Offer", cruise.offerCode, cruise.brand.tint)
                miniStat("Points", cruise.casinoPoints.formatted(), EasySeasTheme.purple)
            }

            HStack {
                Text("Paid \(Formatters.dollars(cruise.totalPaid))")
                Spacer()
                Text("Value \(Formatters.dollars(cruise.retailValue))")
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(cruise.brand.tint.opacity(0.18), lineWidth: 1))
        .cardShadow()
    }

    private func miniStat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value.isEmpty ? "—" : value)
                .font(.caption.weight(.heavy))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(9)
        .background(color.opacity(0.09), in: .rect(cornerRadius: 11))
    }
}
