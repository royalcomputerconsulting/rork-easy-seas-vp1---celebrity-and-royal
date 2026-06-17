import SwiftUI

struct SyncNowSheet: View {
    @Bindable var store: EasySeasStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        CompassLogoView(size: 50)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Sync Log")
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(EasySeasTheme.navy)
                            Text(store.selectedBrand.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(store.selectedBrand.tint)
                        }
                        Spacer()
                        if store.isSyncing {
                            ProgressView()
                        }
                    }

                    Text(store.lastSyncSummary)
                        .font(.subheadline)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                        .lineSpacing(4)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(EasySeasTheme.background, in: .rect(cornerRadius: 16))

                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(store.syncLogs.suffix(8).reversed()) { entry in
                            SyncLogRow(entry: entry)
                            if entry.id != store.syncLogs.suffix(8).first?.id {
                                Divider()
                            }
                        }
                    }
                    .padding(14)
                    .background(.white, in: .rect(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
                }
                .padding(16)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Sync Now")
            .toolbarTitleDisplayMode(.inline)
        }
    }
}
