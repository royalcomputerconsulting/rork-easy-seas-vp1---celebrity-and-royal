import SwiftUI

struct SettingsScreen: View {
    @Bindable var store: EasySeasStore
    @State private var showingSyncSheet: Bool = false
    @State private var showingResetConfirmation: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    SectionHeader(title: "Settings", subtitle: "Sync casino programs, manage profile context, and review legal notices.", systemImage: "gearshape.fill")

                    profileCard
                    syncCard
                    toolsCard
                    legalCard
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 100)
            }
            .background(EasySeasTheme.background.ignoresSafeArea())
            .navigationTitle("Settings")
            .toolbarTitleDisplayMode(.large)
            .sheet(isPresented: $showingSyncSheet) {
                SyncNowSheet(store: store)
                    .presentationDetents([.medium, .large])
                    .presentationContentInteraction(.scrolls)
            }
            .confirmationDialog("Reset native Easy Seas data?", isPresented: $showingResetConfirmation, titleVisibility: .visible) {
                Button("Reset to sample baseline", role: .destructive) {
                    withAnimation(.snappy) { store.resetToSampleData() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var profileCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            NavigationLink {
                ProfileEditScreen(store: store)
            } label: {
                HStack(spacing: 12) {
                    CompassLogoView(size: 54)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Easy Seas Profile")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(EasySeasTheme.navy)
                        Text(store.memberEmail)
                            .font(.subheadline)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }
            .buttonStyle(.plain)
            HStack(spacing: 8) {
                BrandPill(brand: .royalCaribbean, isSelected: store.selectedBrand == .royalCaribbean)
                BrandPill(brand: .celebrity, isSelected: store.selectedBrand == .celebrity)
            }
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private var syncCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Royal / Celebrity Sync", subtitle: "Capture all offers, sailings per offer, booked cruises, upcoming cruises, loyalty, and completed history.", systemImage: "arrow.triangle.2.circlepath")
            PrimaryButton(title: store.isSyncing ? "Syncing…" : "Sync Now", systemImage: "arrow.triangle.2.circlepath", isLoading: store.isSyncing) {
                showingSyncSheet = true
                Task { await store.runDemoSync() }
            }
            Text(store.lastSyncSummary)
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 14))
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private var toolsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Native Clone Tools", subtitle: "Expo companion flows now available in Swift.", systemImage: "square.grid.2x2.fill")
            toolLink("Advisor", "Offer intelligence and trip-stack recommendations", "sparkles") {
                AdvisorScreen(store: store)
            }
            toolLink("Data Health", "QA offers, sailings, dates, duplicates, and unmatched codes", "checkmark.shield.fill") {
                DataHealthScreen(store: store)
            }
            toolLink("Import Review", "Review and apply assignment merges", "tray.and.arrow.down.fill") {
                ImportReviewScreen(store: store)
            }
            toolLink("SeaPass Generator", "Generate a safe native pass preview", "creditcard.fill") {
                SeaPassGeneratorScreen(store: store)
            }
            Button(role: .destructive) {
                showingResetConfirmation = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "arrow.counterclockwise")
                        .frame(width: 36, height: 36)
                        .background(Color.red.opacity(0.10), in: .circle)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Reset Demo Data")
                            .font(.subheadline.weight(.heavy))
                        Text("Restore the native clone baseline")
                            .font(.caption)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    Spacer()
                }
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))
        .cardShadow()
    }

    private func toolLink<Destination: View>(_ title: String, _ subtitle: String, _ systemImage: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink {
            destination()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(EasySeasTheme.nauticalGradient, in: .circle)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private var legalCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Disclaimer")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)
            Text("Easy Seas is for informational planning only. It is not gambling, legal, financial, or tax advice. Cruise line trademarks and program names belong to their respective owners; Easy Seas is not affiliated with or endorsed by those companies.")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
        }
        .padding(16)
        .background(.white, in: .rect(cornerRadius: 20))
    }
}
