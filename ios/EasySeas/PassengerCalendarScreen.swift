import SwiftUI

/// Passenger calendar view — lists all booked cruises by passenger occupancy type.
struct PassengerCalendarScreen: View {
    @Bindable var store: EasySeasStore

    private var upcomingCruises: [BookedCruise] {
        store.upcomingBookedCruises.sorted { $0.sailDate < $1.sailDate }
    }

    private var completedCruises: [BookedCruise] {
        store.completedBookedCruises.sorted { $0.sailDate > $1.sailDate }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                summaryCard
                upcomingSection
                completedSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("Passenger Calendar")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "person.2.fill")
                    .font(.title2)
                    .foregroundStyle(EasySeasTheme.gold)
                Text("Passenger Calendar")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(.white)
            }
            Text("\(store.selectedBookedCruises.count) total cruises • \(upcomingCruises.count) upcoming • \(completedCruises.count) completed")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var summaryCard: some View {
        HStack(spacing: 10) {
            StatTile(label: "Upcoming", value: "\(upcomingCruises.count)", systemImage: "calendar.badge.plus", color: EasySeasTheme.aqua)
            StatTile(label: "Completed", value: "\(completedCruises.count)", systemImage: "checkmark.seal.fill", color: EasySeasTheme.purple)
            StatTile(label: "Total Nights", value: "\(store.selectedBookedCruises.reduce(0) { $0 + $1.nights })", systemImage: "moon.stars.fill", color: EasySeasTheme.navy)
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Upcoming Cruises", subtitle: "Booked cruises with sail dates in the future.", systemImage: "calendar.badge.plus")
            if upcomingCruises.isEmpty {
                EmptyStateView(title: "No upcoming cruises", subtitle: "Book a sailing from the Cruises tab or run Sync Now.", systemImage: "calendar")
            } else {
                ForEach(upcomingCruises) { cruise in
                    NavigationLink {
                        BookedCruiseDetailScreen(cruise: cruise)
                    } label: {
                        passengerCruiseRow(cruise)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var completedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Completed Cruises", subtitle: "Past cruises with return dates before today.", systemImage: "checkmark.seal.fill")
            if completedCruises.isEmpty {
                EmptyStateView(title: "No completed cruises", subtitle: "Completed cruises appear here after Sync Now or manual import.", systemImage: "checkmark.seal")
            } else {
                ForEach(completedCruises.prefix(10)) { cruise in
                    NavigationLink {
                        BookedCruiseDetailScreen(cruise: cruise)
                    } label: {
                        passengerCruiseRow(cruise)
                    }
                    .buttonStyle(.plain)
                }
                if completedCruises.count > 10 {
                    Text("+ \(completedCruises.count - 10) more completed cruises")
                        .font(.caption)
                        .foregroundStyle(EasySeasTheme.textSecondary)
                }
            }
        }
    }

    private func passengerCruiseRow(_ cruise: BookedCruise) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(cruise.shipName)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(EasySeasTheme.navy)
                Text(cruise.itineraryName)
                    .font(.caption)
                    .foregroundStyle(EasySeasTheme.textSecondary)
                    .lineLimit(1)
                Text("\(Formatters.shortDate.string(from: cruise.sailDate)) • \(cruise.nights)N • \(cruise.offerCode)")
                    .font(.caption2)
                    .foregroundStyle(EasySeasTheme.aqua)
            }
            Spacer()
            Text(cruise.status)
                .font(.caption.weight(.heavy))
                .foregroundStyle(cruise.isCompleted ? EasySeasTheme.purple : EasySeasTheme.money)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background((cruise.isCompleted ? EasySeasTheme.purple : EasySeasTheme.money).opacity(0.1), in: .capsule)
        }
        .padding(12)
        .background(.white, in: .rect(cornerRadius: 14)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(EasySeasTheme.border, lineWidth: 1))
    }
}
