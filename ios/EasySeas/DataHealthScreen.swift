import SwiftUI

struct DataHealthScreen: View {
    @Bindable var store: EasySeasStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                SectionHeader(title: "Data Health", subtitle: "QA checks for offers, sailings, booked cruises, dates, and duplicate-safe imports.", systemImage: "checkmark.shield.fill")

                HStack(spacing: 10) {
                    stat("Offers", "\(store.offers.count)", EasySeasTheme.gold)
                    stat("Sailings", "\(store.sailings.count)", EasySeasTheme.aqua)
                    stat("Booked", "\(store.bookedCruises.count)", EasySeasTheme.money)
                }

                VStack(alignment: .leading, spacing: 12) {
                    ForEach(store.dataHealthFindings, id: \.self) { finding in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: finding.contains("need") ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                                .foregroundStyle(finding.contains("need") ? EasySeasTheme.gold : EasySeasTheme.money)
                            Text(finding)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EasySeasTheme.navy)
                            Spacer()
                        }
                    }
                }
                .padding(16)
                .background(.white, in: .rect(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))

                Text("This native QA mirrors the Expo app’s data-health intent: detect unmatched offer codes, protect date parsing, and verify the final Sync Now summary tells users how many cruises came from every offer.")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .lineSpacing(3)
                    .padding(14)
                    .background(EasySeasTheme.background, in: .rect(cornerRadius: 16))
            }
            .padding(16)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Data Health")
        .toolbarTitleDisplayMode(.inline)
    }

    private func stat(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title3.weight(.heavy))
                .foregroundStyle(color)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.white, in: .rect(cornerRadius: 16))
    }
}
