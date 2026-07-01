import SwiftUI

/// Command Center / War Room — offer expiration management with urgency buckets.
struct WarRoomScreen: View {
    @Bindable var store: EasySeasStore

    enum Bucket: String, CaseIterable, Identifiable {
        case expires7, expires14, expires30, recentlyExpired, needsReview
        var id: String { rawValue }
        var title: String {
            switch self {
            case .expires7: "Expires 0-7 Days"
            case .expires14: "Expires 8-14 Days"
            case .expires30: "Expires 15-30 Days"
            case .recentlyExpired: "Recently Expired"
            case .needsReview: "Needs Review"
            }
        }
        var symbol: String {
            switch self {
            case .expires7: "exclamationmark.triangle.fill"
            case .expires14: "clock.badge.exclamationmark.fill"
            case .expires30: "calendar.badge.clock"
            case .recentlyExpired: "xmark.shield.fill"
            case .needsReview: "questionmark.circle.fill"
            }
        }
        var tint: Color {
            switch self {
            case .expires7: Color.red
            case .expires14: Color.orange
            case .expires30: Color.yellow
            case .recentlyExpired: Color.gray
            case .needsReview: Color.purple
            }
        }
    }

    struct BucketedOffer: Identifiable {
        let id: String
        let offer: CruiseOffer
        let daysRemaining: Int
    }

    private var buckets: [(Bucket, [BucketedOffer])] {
        let today = Date()
        var byBucket: [Bucket: [BucketedOffer]] = [:]

        for offer in store.activeOffers {
            let days = Calendar.current.dateComponents([.day], from: today, to: offer.expiresOn).day ?? 0
            let bucket: Bucket
            if days < 0 {
                bucket = .recentlyExpired
            } else if days <= 7 {
                bucket = .expires7
            } else if days <= 14 {
                bucket = .expires14
            } else if days <= 30 {
                bucket = .expires30
            } else {
                bucket = .needsReview
            }
            let entry = BucketedOffer(id: offer.id.uuidString, offer: offer, daysRemaining: max(0, days))
            byBucket[bucket, default: []].append(entry)
        }
        return Bucket.allCases.compactMap { bucket in
            guard let items = byBucket[bucket], !items.isEmpty else { return nil }
            return (bucket, items)
        }
    }

    private var urgentCount: Int {
        buckets.filter { $0.0 == .expires7 || $0.0 == .expires14 }.reduce(0) { $0 + $1.1.count }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                if buckets.isEmpty {
                    EmptyStateView(title: "No offers to manage", subtitle: "Run Sync Now from Settings to import casino offers with expiration dates.", systemImage: "clock.badge.checkmark")
                } else {
                    ForEach(buckets, id: \.0.rawValue) { bucket, offers in
                        bucketCard(bucket, offers)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Command Center")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "clock.badge")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Expiration Command Center")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("\(urgentCount) offer(s) expiring soon. Review urgency buckets below to prioritize bookings before offers expire.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
                .lineSpacing(3)

            HStack(spacing: 12) {
                statPill("\(store.activeOffers.count)", "Active")
                statPill("\(urgentCount)", "Urgent", EasySeasTheme.gold)
                statPill("\(store.upcomingSailings.count)", "Sailings")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private func statPill(_ value: String, _ label: String, _ color: Color = .white) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline.weight(.heavy)).foregroundStyle(color)
            Text(label).font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.7))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.white.opacity(0.12), in: .capsule)
    }

    private func bucketCard(_ bucket: Bucket, _ offers: [BucketedOffer]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: bucket.symbol)
                    .foregroundStyle(bucket.tint)
                Text(bucket.title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.navy)
                Spacer()
                Text("\(offers.count)")
                    .font(.title3.weight(.heavy))
                    .foregroundStyle(bucket.tint)
            }

            ForEach(offers.prefix(5)) { item in
                offerRow(item)
            }

            if offers.count > 5 {
                Text("+ \(offers.count - 5) more in this bucket")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .padding(.top, 4)
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func offerRow(_ item: BucketedOffer) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "tag.fill")
                .font(.caption)
                .foregroundStyle(EasySeasTheme.aqua)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.offer.name)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(EasySeasTheme.navy)
                    .lineLimit(1)
                Text("Code: \(item.offer.code) • Expires \(Formatters.shortDate.string(from: item.offer.expiresOn))")
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            if item.daysRemaining > 0 {
                Text("\(item.daysRemaining)d")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(item.daysRemaining <= 7 ? Color.red : item.daysRemaining <= 14 ? Color.orange : EasySeasTheme.navy)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(item.daysRemaining <= 7 ? Color.red.opacity(0.1) : item.daysRemaining <= 14 ? Color.orange.opacity(0.1) : EasySeasTheme.navy.opacity(0.06), in: .capsule)
            }
        }
        .padding(10)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
    }
}
