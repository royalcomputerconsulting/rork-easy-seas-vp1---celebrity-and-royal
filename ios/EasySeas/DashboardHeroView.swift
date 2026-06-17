import SwiftUI

struct DashboardHeroView: View {
    @Bindable var store: EasySeasStore

    private var pinnacleProgress: Double {
        min(Double(store.crownAnchorPoints) / 700.0, 1.0)
    }

    private var royaleProgress: Double {
        min(Double(store.clubRoyalePoints) / 100_000.0, 1.0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                CompassLogoView(size: 62)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Easy Seas")
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text("Manage your Nautical Lifestyle")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                    HStack(spacing: 8) {
                        Text("Signature")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(EasySeasTheme.purple, in: .capsule)
                        Text("Diamond")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(EasySeasTheme.aqua, in: .capsule)
                    }
                    .padding(.top, 2)
                }

                Spacer()

                Image(systemName: "bell.badge.fill")
                    .font(.title3)
                    .foregroundStyle(EasySeasTheme.gold)
                    .frame(width: 42, height: 42)
                    .background(.white.opacity(0.82), in: .circle)
                    .cardShadow()
            }

            VStack(spacing: 12) {
                ProgressMetricView(
                    title: "Pinnacle (\(store.crownAnchorPoints)/700)",
                    detail: "Projected progress • \(700 - min(store.crownAnchorPoints, 700)) pts needed",
                    progress: pinnacleProgress,
                    tint: EasySeasTheme.aqua
                )
                ProgressMetricView(
                    title: "Masters (\(store.clubRoyalePoints.formatted()) points)",
                    detail: "Club Royale resets April 1",
                    progress: royaleProgress,
                    tint: EasySeasTheme.purple
                )
            }

            HStack(spacing: 0) {
                StatTile(value: store.clubRoyalePoints.formatted(), label: "CR Points", color: EasySeasTheme.aqua)
                Divider().frame(height: 34)
                StatTile(value: "\(store.crownAnchorPoints)", label: "C&A", color: EasySeasTheme.purple)
                Divider().frame(height: 34)
                StatTile(value: "\(store.upcomingSailings.count)", label: "Available")
                Divider().frame(height: 34)
                StatTile(value: "\(store.upcomingBookedCruises.count)", label: "Booked", color: EasySeasTheme.money)
                Divider().frame(height: 34)
                StatTile(value: "\(store.activeOffers.count)", label: "Offers", color: EasySeasTheme.gold)
            }
            .padding(.vertical, 10)
            .background(.white.opacity(0.74), in: .rect(cornerRadius: 16))
        }
        .padding(16)
        .background(EasySeasTheme.softCardGradient, in: .rect(cornerRadius: 22))
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(EasySeasTheme.border, lineWidth: 1)
        )
        .cardShadow()
        .accessibilityElement(children: .contain)
    }
}
