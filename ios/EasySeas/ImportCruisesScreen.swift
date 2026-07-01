import SwiftUI

/// Screen for importing cruises from external sources (CSV, manual entry).
struct ImportCruisesScreen: View {
    @Bindable var store: EasySeasStore
    @State private var importMethod: ImportMethod = .csv
    @State private var csvPreview: [String] = []
    @State private var showPreview: Bool = false
    @State private var detectedRows: Int = 0

    enum ImportMethod: String, CaseIterable, Identifiable {
        case csv, manual, web
        var id: String { rawValue }
        var label: String {
            switch self {
            case .csv: "CSV Import"
            case .manual: "Manual Entry"
            case .web: "Web Sync"
            }
        }
        var symbol: String {
            switch self {
            case .csv: "tablecells.fill"
            case .manual: "pencil.and.list.clipboard"
            case .web: "globe"
            }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                methodPicker
                methodContent
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Import Cruises")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "square.and.arrow.down.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Import Cruise Data")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("Import casino offers, booked cruises, and sailing data from CSV files, manual entry, or web sync services.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var methodPicker: some View {
        HStack(spacing: 8) {
            ForEach(ImportMethod.allCases) { method in
                Button {
                    withAnimation(.snappy) { importMethod = method }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: method.symbol)
                            .font(.caption)
                        Text(method.label)
                            .font(.caption.weight(.bold))
                    }
                    .foregroundStyle(importMethod == method ? .white : EasySeasTheme.navy)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(importMethod == method ? EasySeasTheme.navy : EasySeasTheme.navy.opacity(0.08), in: .capsule)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    @ViewBuilder
    private var methodContent: some View {
        switch importMethod {
        case .csv:
            csvSection
        case .manual:
            manualSection
        case .web:
            webSection
        }
    }

    private var csvSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "CSV Import", subtitle: "Import casino offers and booked cruises from CSV files.", systemImage: "tablecells.fill")

            VStack(spacing: 10) {
                csvActionButton("Casino Offers CSV", "tag.fill", "Import offer codes, names, expiry dates, trade-in values, and perks") {
                    simulateOfferImport()
                }
                csvActionButton("Booked Cruises CSV", "ferry.fill", "Import reservation numbers, ships, dates, cabin types, and casino points") {
                    simulateBookedImport()
                }
                csvActionButton("Cruise Sailings CSV", "calendar.badge.clock", "Import sailing data with ship names, itineraries, and destination ports") {
                    simulateSailingImport()
                }
            }

            if showPreview {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Preview: \(detectedRows) rows detected")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(EasySeasTheme.navy)
                    ForEach(csvPreview.prefix(5), id: \.self) { row in
                        Text(row)
                            .font(.caption.monospaced())
                            .foregroundStyle(EasySeasTheme.textSecondary)
                            .lineLimit(1)
                    }
                    if csvPreview.count > 5 {
                        Text("... and \(csvPreview.count - 5) more rows")
                            .font(.caption)
                            .foregroundStyle(EasySeasTheme.textSecondary)
                    }
                    PrimaryButton(title: "Apply Import", systemImage: "checkmark") {
                        store.applyImportReview()
                        showPreview = false
                    }
                }
                .padding(14)
                .background(.white, in: .rect(cornerRadius: 18)))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
            }
        }
    }

    private func csvActionButton(_ title: String, _ symbol: String, _ subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .frame(width: 32, height: 32)
                    .background(EasySeasTheme.aqua.opacity(0.12), in: .circle)
                    .foregroundStyle(EasySeasTheme.aqua)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                    Text(subtitle).font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
                }
                Spacer()
                Image(systemName: "arrow.down.doc.fill").font(.caption).foregroundStyle(EasySeasTheme.aqua)
            }
            .padding(12)
            .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
        }
        .buttonStyle(.plain)
    }

    private var manualSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Manual Entry", subtitle: "Enter cruise details by hand for full control.", systemImage: "pencil.and.list.clipboard")
            Text("Manual entry allows you to add individual cruises, offers, and bookings without importing files. Each entry is validated and merged into your existing portfolio.")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var webSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Web Sync", subtitle: "Sync directly from cruise line account pages.", systemImage: "globe")
            Text("Web sync captures casino offers, booked cruises, loyalty data, and completed cruise history directly from Royal Caribbean, Celebrity, and Carnival account pages.")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(3)
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
            PrimaryButton(title: "Open Sync Now", systemImage: "arrow.triangle.2.circlepath") {}
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func simulateOfferImport() {
        csvPreview = [
            "offerCode,offerName,expiryDate,tradeInValue,freePlay,obc,status",
            "26BCP105,Limitless Luck,2026-09-15,950,250,100,Active",
            "2605C03A,May Jackpot Getaway,2026-08-31,1200,400,250,Active",
            "26JUL104,Summer Casino Preview,2026-10-04,700,150,75,Active",
            "26TOC208,Blue Chip Mediterranean,2026-11-20,1500,500,300,Active",
        ]
        detectedRows = 4
        showPreview = true
    }

    private func simulateBookedImport() {
        csvPreview = [
            "reservationNumber,shipName,sailDate,returnDate,nights,offerCode,retailValue,totalPaid",
            "4892371,Ovation of the Seas,2026-06-26,2026-07-03,7,26BCP105,4120,226",
            "3158840,Icon of the Seas,2026-11-21,2026-11-28,7,2605C03A,5840,311",
        ]
        detectedRows = 2
        showPreview = true
    }

    private func simulateSailingImport() {
        csvPreview = [
            "offerCode,shipName,itineraryName,sailDate,returnDate,nights,cabinType,retailValue",
            "2605C03A,Utopia of the Seas,Bahamas Perfect Day,2026-07-10,2026-07-14,4,Balcony,2430",
            "2605C03A,Wonder of the Seas,Eastern Caribbean,2026-08-02,2026-08-09,7,OceanView,3860",
        ]
        detectedRows = 2
        showPreview = true
    }
}
