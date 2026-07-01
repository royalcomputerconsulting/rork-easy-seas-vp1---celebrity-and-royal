import SwiftUI

/// Paywall screen — premium subscription upsell equivalent to Expo's paywall route.
struct PaywallScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 20)

                VStack(spacing: 8) {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(EasySeasTheme.gold)
                    Text("EasySeas Premium")
                        .font(.largeTitle.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text("Unlock your full cruise portfolio intelligence")
                        .font(.subheadline)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 14) {
                    premiumFeature("chart.line.uptrend.xyaxis", "Advanced Casino Analytics", "ROI projections, tier progression, risk analysis charts")
                    premiumFeature("arrow.triangle.2.circlepath", "Automated Sync", "Royal Caribbean, Celebrity, and Carnival auto-sync every 24 hours")
                    premiumFeature("wand.and.stars", "AI-Powered Advisor", "Personalized offer comparison and trip stacking recommendations")
                    premiumFeature("square.and.arrow.down.fill", "Unlimited Export", "CSV, DOCX, and PDF export without watermark limits")
                    premiumFeature("bell.badge.fill", "Price Alerts", "Real-time cruise price tracking and drop notifications")
                }
                .padding(20)
                .background(.white, in: .rect(cornerRadius: 20)))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))

                // Pricing options
                VStack(spacing: 12) {
                    pricingOption("Monthly", "$9.99/mo", false)
                    pricingOption("Annual", "$79.99/yr", true)
                }

                PrimaryButton(title: "Subscribe Now", systemImage: "crown.fill") {
                    // Payment integration would go here
                    dismiss()
                }

                VStack(spacing: 6) {
                    Text("All plans include a 7-day free trial")
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                    Button("Restore Purchases") {
                        // Restore logic
                    }
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.aqua)
                }

                Text("Easy Seas is for informational planning only. It is not gambling, legal, financial, or tax advice.")
                    .font(.caption2)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 40)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Premium")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func premiumFeature(_ symbol: String, _ title: String, _ subtitle: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(EasySeasTheme.nauticalGradient, in: .circle)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
        }
    }

    private func pricingOption(_ name: String, _ price: String, _ isRecommended: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(name)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    if isRecommended {
                        Text("BEST VALUE")
                            .font(.caption2.weight(.heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(EasySeasTheme.money, in: .capsule)
                    }
                }
                Text(price)
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
            }
            Spacer()
            if isRecommended {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.money)
            }
        }
        .padding(16)
        .background(isRecommended ? EasySeasTheme.gold.opacity(0.08) : .white, in: .rect(cornerRadius: 16)))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(isRecommended ? EasySeasTheme.gold : EasySeasTheme.border, lineWidth: isRecommended ? 2 : 1))
    }
}
