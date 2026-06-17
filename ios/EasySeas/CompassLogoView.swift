import SwiftUI

struct CompassLogoView: View {
    var size: CGFloat = 64

    var body: some View {
        ZStack {
            Circle()
                .fill(EasySeasTheme.nauticalGradient)
            Circle()
                .stroke(EasySeasTheme.gold.opacity(0.9), lineWidth: size * 0.055)
                .padding(size * 0.11)
            Image(systemName: "safari.fill")
                .font(.system(size: size * 0.46, weight: .semibold))
                .foregroundStyle(EasySeasTheme.gold)
                .rotationEffect(.degrees(-24))
            Image(systemName: "water.waves")
                .font(.system(size: size * 0.20, weight: .bold))
                .foregroundStyle(EasySeasTheme.aquaLight)
                .offset(y: size * 0.19)
        }
        .frame(width: size, height: size)
        .shadow(color: EasySeasTheme.aqua.opacity(0.25), radius: 14, x: 0, y: 8)
        .accessibilityHidden(true)
    }
}
