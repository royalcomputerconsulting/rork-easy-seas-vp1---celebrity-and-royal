import SwiftUI

struct CruiseSailingCardView: View {
    let sailing: CruiseSailing
    var onBook: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(sailing.shipName)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(sailing.itineraryName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(sailing.nights)n")
                        .font(.title3.weight(.heavy))
                        .foregroundStyle(sailing.brand.tint)
                    Text(sailing.cabinType.rawValue)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }

            HStack(spacing: 10) {
                Label(Formatters.monthDay.string(from: sailing.sailDate), systemImage: "calendar")
                Label(sailing.departurePort, systemImage: "mappin.and.ellipse")
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(EasySeasTheme.textSecondary)

            FlowPills(items: sailing.tags + [sailing.offerCode], tint: sailing.brand.tint)

            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Taxes & fees")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                    Text(Formatters.dollars(sailing.taxesFees))
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.money)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("Retail value")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                    Text(Formatters.dollars(sailing.retailValue))
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.gold)
                }
            }

            if let onBook {
                Button(action: onBook) {
                    Label("Mark as Booked", systemImage: "checkmark.seal.fill")
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(sailing.brand.tint, in: .rect(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }
}
