import SwiftUI

struct CasinoScreen: View {
    @Bindable var store: EasySeasStore

    private var netValue: Double {
        store.totalRetailValue - store.totalPaid
    }

    private var completedPoints: Int {
        store.completedBookedCruises.reduce(0) { $0 + $1.casinoPoints }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    SectionHeader(title: "Casino Intelligence", subtitle: "Portfolio value, tier progress, and completed-cruise performance.", systemImage: "chart.line.uptrend.xyaxis")

                    VStack(alignment: .leading, spacing: 16) {
                        Text("2026 Casino Season")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(.white)
                        HStack(spacing: 10) {
                            darkMetric("Current points", store.clubRoyalePoints.formatted())
                            darkMetric("Completed points", completedPoints.formatted())
                        }
                        HStack(spacing: 10) {
                            darkMetric("Retail value", Formatters.dollars(store.totalRetailValue))
                            darkMetric("Net captured", Formatters.dollars(netValue))
                        }
                        ProgressMetricView(
                            title: "Path to Masters",
                            detail: "Based on imported and app-entered play",
                            progress: min(Double(store.clubRoyalePoints) / 100_000.0, 1.0),
                            tint: EasySeasTheme.gold
                        )
                        .padding(12)
                        .background(.white.opacity(0.92), in: .rect(cornerRadius: 16))
                    }
                    .padding(16)
                    .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 24))
                    .cardShadow()

                    SectionHeader(title: "Completed Cruise ROI", subtitle: "Value history from completed sailings only.", systemImage: "dollarsign.circle.fill")

                    ForEach(store.completedBookedCruises) { cruise in
                        NavigationLink {
                            BookedCruiseDetailScreen(cruise: cruise)
                        } label: {
                            BookedCruiseCardView(cruise: cruise)
                        }
                        .buttonStyle(.plain)
                    }

                    if store.completedBookedCruises.isEmpty {
                        EmptyStateView(title: "No completed cruises yet", subtitle: "Completed Royal and Celebrity cruises appear here after Sync Now.", systemImage: "chart.bar")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Casino")
            .toolbarTitleDisplayMode(.large)
        }
    }

    private func darkMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.gold)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.76))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white.opacity(0.10), in: .rect(cornerRadius: 16))
    }
}
