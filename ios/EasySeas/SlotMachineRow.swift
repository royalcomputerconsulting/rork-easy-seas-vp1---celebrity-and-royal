import SwiftUI

struct SlotMachineRow: View {
    let machine: SlotMachine
    var onFavorite: () -> Void

    var body: some View {
        HStack(spacing: 13) {
            ZStack {
                RoundedRectangle(cornerRadius: 15)
                    .fill(EasySeasTheme.nauticalGradient)
                Image(systemName: "gamecontroller.fill")
                    .font(.title3)
                    .foregroundStyle(EasySeasTheme.gold)
            }
            .frame(width: 54, height: 54)

            VStack(alignment: .leading, spacing: 5) {
                Text(machine.name)
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Text("\(machine.manufacturer) • \(machine.volatility) volatility")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                Text(machine.shipsSeen.joined(separator: ", "))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(EasySeasTheme.aqua)
                    .lineLimit(1)
            }
            Spacer()
            Button(action: onFavorite) {
                Image(systemName: machine.isFavorite ? "star.fill" : "star")
                    .font(.title3)
                    .foregroundStyle(machine.isFavorite ? EasySeasTheme.gold : EasySeasTheme.textSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(.white, in: .rect(cornerRadius: 18))
    }
}
