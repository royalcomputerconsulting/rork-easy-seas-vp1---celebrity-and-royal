import SwiftUI

struct ImportReviewScreen: View {
    @Bindable var store: EasySeasStore
    @State private var didApply: Bool = false

    private struct Assignment: Identifiable {
        let offer: CruiseOffer
        let count: Int

        var id: UUID { offer.id }
    }

    private var groupedSailings: [Assignment] {
        store.activeOffers.map { offer in
            let count = store.sailings.filter { $0.brand == offer.brand && $0.offerCode.caseInsensitiveCompare(offer.code) == .orderedSame }.count
            return Assignment(offer: offer, count: count)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                SectionHeader(title: "Import Review", subtitle: "Review offer-code assignments before merging, matching the Expo review workflow.", systemImage: "tray.and.arrow.down.fill")

                VStack(alignment: .leading, spacing: 12) {
                    ForEach(groupedSailings) { assignment in
                        HStack(spacing: 12) {
                            Image(systemName: "tag.fill")
                                .foregroundStyle(.white)
                                .frame(width: 38, height: 38)
                                .background(assignment.offer.brand.tint, in: .circle)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(assignment.offer.name)
                                    .font(.subheadline.weight(.heavy))
                                    .foregroundStyle(EasySeasTheme.navy)
                                Text("\(assignment.offer.code) • \(assignment.count) cruise(s)")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(EasySeasTheme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(EasySeasTheme.money)
                        }
                    }
                }
                .padding(16)
                .background(.white, in: .rect(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(EasySeasTheme.border, lineWidth: 1))

                PrimaryButton(title: didApply ? "Assignments Applied" : "Apply Reviewed Assignments", systemImage: didApply ? "checkmark.seal.fill" : "arrow.triangle.merge") {
                    withAnimation(.snappy) {
                        store.applyImportReview()
                        didApply = true
                    }
                }

                Text(store.lastSyncSummary)
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(EasySeasTheme.background, in: .rect(cornerRadius: 16))
            }
            .padding(16)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Import Review")
        .toolbarTitleDisplayMode(.inline)
    }
}
