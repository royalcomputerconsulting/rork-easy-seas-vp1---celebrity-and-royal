import SwiftUI

/// Day agenda — daily planner view of cruise events, deadlines, and activities.
struct DayAgendaScreen: View {
    @Bindable var store: EasySeasStore

    private var todayEvents: [CalendarEventItem] {
        store.calendarEvents.filter {
            Calendar.current.isDate($0.date, inSameDayAs: Date())
        }
    }

    private var upcomingWeek: [CalendarEventItem] {
        let today = Date()
        let weekFromNow = Calendar.current.date(byAdding: .day, value: 7, to: today) ?? today
        return store.calendarEvents.filter { $0.date >= today && $0.date <= weekFromNow }
            .sorted { $0.date < $1.date }
    }

    private var offerDeadlines: [(offer: CruiseOffer, daysRemaining: Int)] {
        store.activeOffers.compactMap { offer in
            let days = Calendar.current.dateComponents([.day], from: Date(), to: offer.expiresOn).day ?? 0
            guard days >= 0 else { return nil }
            return (offer, days)
        }.sorted { $0.daysRemaining < $1.daysRemaining }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                todaySection
                upcomingWeekSection
                deadlinesSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Day Agenda")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "calendar.badge.clock")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text(Formatters.shortDate.string(from: Date()))
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("\(todayEvents.count) event(s) today • \(upcomingWeek.count) in the next 7 days • \(offerDeadlines.count) offer deadlines")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var todaySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Today", subtitle: "\(todayEvents.count) event(s)", systemImage: "sun.max.fill")
            if todayEvents.isEmpty {
                Text("No events today.").font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            } else {
                ForEach(todayEvents) { event in
                    agendaEventRow(event)
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var upcomingWeekSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Next 7 Days", subtitle: "\(upcomingWeek.count) upcoming event(s)", systemImage: "calendar")
            if upcomingWeek.isEmpty {
                Text("No events in the next 7 days.").font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            } else {
                ForEach(upcomingWeek) { event in
                    agendaEventRow(event)
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var deadlinesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Offer Deadlines", subtitle: "\(offerDeadlines.count) expiring offers", systemImage: "timer")
            if offerDeadlines.isEmpty {
                Text("No expiring offers.").font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            } else {
                ForEach(offerDeadlines.prefix(6), id: \.offer.code) { entry in
                    HStack(spacing: 10) {
                        Image(systemName: "tag.fill")
                            .foregroundStyle(EasySeasTheme.aqua)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.offer.name)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(EasySeasTheme.navy)
                            Text("Code: \(entry.offer.code)")
                                .font(.caption)
                                .foregroundStyle(EasySeasTheme.textSecondary)
                        }
                        Spacer()
                        Text("\(entry.daysRemaining)d")
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(entry.daysRemaining <= 7 ? Color.red : entry.daysRemaining <= 14 ? Color.orange : EasySeasTheme.navy)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background((entry.daysRemaining <= 7 ? Color.red : entry.daysRemaining <= 14 ? Color.orange : EasySeasTheme.navy).opacity(0.1), in: .capsule)
                    }
                    .padding(10)
                    .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func agendaEventRow(_ event: CalendarEventItem) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(event.kind == "Cruise" ? EasySeasTheme.navy : EasySeasTheme.gold)
                    .frame(width: 36, height: 36)
                Image(systemName: event.kind == "Cruise" ? "ferry.fill" : "tag.fill")
                    .font(.caption)
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title).font(.subheadline.weight(.bold)).foregroundStyle(EasySeasTheme.navy)
                Text(event.subtitle).font(.caption).foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
            Text(Formatters.shortDate.string(from: event.date))
                .font(.caption2.weight(.bold))
                .foregroundStyle(EasySeasTheme.textSecondary)
        }
        .padding(10)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 14)))
    }
}
