import SwiftUI

struct AdvisorScreen: View {
    @Bindable var store: EasySeasStore

    private var topSailing: CruiseSailing? {
        store.upcomingSailings.max { lhs, rhs in
            (lhs.retailValue - lhs.taxesFees) < (rhs.retailValue - rhs.taxesFees)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                SectionHeader(title: "Advisor", subtitle: "Native version of the Expo trip-stack and offer-intelligence assistant.", systemImage: "sparkles")

                if let topSailing {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Best Value Candidate")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(EasySeasTheme.navy)
                        CruiseSailingCardView(sailing: topSailing) {
                            store.book(topSailing)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    recommendation("Prioritize no-conflict sailings", "The Cruises tab hides date overlaps by default, matching the Expo scheduling guardrail.", "calendar.badge.checkmark")
                    recommendation("Review unmatched history", "Data Health flags historical bookings whose offer codes are no longer active.", "checkmark.shield.fill")
                    recommendation("Track casino ROI", "Casino shows completed points, paid amount, retail value, and net captured value.", "chart.line.uptrend.xyaxis")
                }
                .padding(16)
                .background(.white, in: .rect(cornerRadius: 20))
            }
            .padding(16)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Advisor")
        .toolbarTitleDisplayMode(.inline)
    }

    private func recommendation(_ title: String, _ body: String, _ symbol: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(EasySeasTheme.gold)
                .frame(width: 32, height: 32)
                .background(EasySeasTheme.gold.opacity(0.12), in: .circle)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Text(body)
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
        }
    }
}
