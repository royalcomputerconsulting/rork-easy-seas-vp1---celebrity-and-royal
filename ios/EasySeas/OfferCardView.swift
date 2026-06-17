import SwiftUI

struct OfferCardView: View {
    let offer: CruiseOffer
    let sailingCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(offer.name)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(offer.code)
                        .font(.system(.caption, design: .monospaced).weight(.bold))
                        .foregroundStyle(offer.brand.tint)
                }
                Spacer()
                Text(offer.status.uppercased())
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(EasySeasTheme.money, in: .capsule)
            }

            HStack(spacing: 10) {
                metric("Sailings", "\(sailingCount)", EasySeasTheme.aqua)
                metric("Trade-in", Formatters.dollars(offer.tradeInValue), EasySeasTheme.gold)
                metric("FreePlay", Formatters.dollars(offer.freePlay), EasySeasTheme.purple)
            }

            FlowPills(items: offer.perks, tint: offer.brand.tint)

            HStack {
                Label("Expires \(Formatters.shortDate.string(from: offer.expiresOn))", systemImage: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(EasySeasTheme.textSecondary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(offer.brand.tint.opacity(0.20), lineWidth: 1)
        )
        .cardShadow()
    }

    private func metric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(color.opacity(0.10), in: .rect(cornerRadius: 12))
    }
}
