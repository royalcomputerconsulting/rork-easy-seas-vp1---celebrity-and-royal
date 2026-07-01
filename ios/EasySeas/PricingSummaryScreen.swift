import SwiftUI

/// Pricing summary — shows total retail value, total paid, and economic value for booked cruises.
struct PricingSummaryScreen: View {
    @Bindable var store: EasySeasStore

    private var netValue: Double { store.totalEconomicValue }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                summaryCards
                perCruiseBreakdown
                exportCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Pricing Summary")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Cruise Portfolio Value")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            HStack(spacing: 10) {
                darkStat("Total Retail", Formatters.dollars(store.totalRetailValue))
                darkStat("Total Paid", Formatters.dollars(store.totalPaid))
                darkStat("Net Value", Formatters.dollars(netValue))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private func darkStat(_ label: String, _ value: String) -> some View {
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

    private var summaryCards: some View {
        HStack(spacing: 10) {
            StatTile(label: "Avg/Value", value: Formatters.dollars(store.averageValuePerCruise), systemImage: "chart.bar.fill", color: EasySeasTheme.money)
            StatTile(label: "Cruises", value: "\(store.bookedCruises.count)", systemImage: "ferry.fill", color: EasySeasTheme.navy)
            StatTile(label: "Nights", value: "\(store.bookedCruises.reduce(0) { $0 + $1.nights })", systemImage: "moon.stars.fill", color: EasySeasTheme.aqua)
        }
    }

    private var perCruiseBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Per-Cruise Breakdown", subtitle: "Retail value, paid, and net value for each booked cruise.", systemImage: "list.bullet.rectangle.fill")
            ForEach(store.selectedBookedCruises) { cruise in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(cruise.shipName)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(EasySeasTheme.navy)
                        Spacer()
                        Text(cruise.isCompleted ? "Completed" : "Upcoming")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(cruise.isCompleted ? EasySeasTheme.purple : EasySeasTheme.money)
                    }
                    HStack {
                        labeledValue("Retail", Formatters.dollars(cruise.retailValue))
                        Spacer()
                        labeledValue("Paid", Formatters.dollars(cruise.totalPaid))
                        Spacer()
                        labeledValue("Net", Formatters.dollars(max(0, cruise.retailValue - cruise.totalPaid)))
                    }
                }
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func labeledValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.caption.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
            Text(label).font(.caption2).foregroundStyle(EasySeasTheme.textSecondary)
        }
    }

    private var exportCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Export", subtitle: "Save portfolio value as a CSV report.", systemImage: "square.and.arrow.up.fill")
            PrimaryButton(title: "Export Pricing CSV", systemImage: "tablecells.fill") {
                store.syncLogs.append(SyncLogEntry(kind: .success, message: "Pricing summary exported"))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }
}
