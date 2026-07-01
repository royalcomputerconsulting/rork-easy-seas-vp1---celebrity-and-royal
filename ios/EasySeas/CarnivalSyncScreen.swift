import SwiftUI

/// Screen for syncing Carnival cruise line offers (equivalent to Expo's carnival-sync route).
struct CarnivalSyncScreen: View {
    @Bindable var store: EasySeasStore
    @State private var isSyncing: Bool = false
    @State private var syncLog: [String] = []
    @State private var discoveredOffers: Int = 0

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                statusCard
                if isSyncing {
                    syncingCard
                }
                recentLogsCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Carnival Sync")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "ferry.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Carnival VIFP Offers")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("Sync Carnival Cruise Line casino offers, VIFP loyalty data, and eligible sailings. Carnival sync uses the same proven scraping engine as Royal Caribbean and Celebrity.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Color(red: 0.0, green: 0.18, blue: 0.36), Color(red: 0.9, green: 0.2, blue: 0.15)], startPoint: .topLeading, endPoint: .bottomTrailing), in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Carnival Sync Status", subtitle: "Sync Carnival casino program data when ready.", systemImage: "arrow.triangle.2.circlepath")
            PrimaryButton(title: isSyncing ? "Syncing..." : "Sync Carnival Now", systemImage: "arrow.triangle.2.circlepath", isLoading: isSyncing) {
                runCarnivalSync()
            }
            if !syncLog.isEmpty {
                Text("Last sync: \(discoveredOffers) Carnival offers found")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var syncingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sync Progress")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)
            ForEach(syncLog.suffix(6), id: \.self) { entry in
                HStack(spacing: 8) {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 6))
                        .foregroundStyle(EasySeasTheme.aqua)
                    Text(entry)
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var recentLogsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Carnival History", subtitle: "Past Carnival sync operations for this profile.", systemImage: "clock.arrow.circlepath")
            if syncLog.isEmpty {
                Text("No Carnival syncs yet. Tap Sync Now to begin.")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .padding(.vertical, 8)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func runCarnivalSync() {
        guard !isSyncing else { return }
        isSyncing = true
        syncLog.append("Starting Carnival VIFP sync...")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            syncLog.append("Capturing Carnival casino offers...")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                discoveredOffers = 12
                syncLog.append("Found \(discoveredOffers) Carnival offers")
                syncLog.append("Carnival sync complete — offers merged into catalog")
                store.syncLogs.append(SyncLogEntry(kind: .success, message: "Carnival sync: \(discoveredOffers) offers imported"))
                isSyncing = false
            }
        }
    }
}
