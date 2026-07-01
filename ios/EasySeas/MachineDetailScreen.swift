import SwiftUI

struct MachineDetailScreen: View {
    let machine: SlotMachine
    @Bindable var store: EasySeasStore

    @State private var showQuickWinModal: Bool = false
    @State private var winAmount: String = ""
    @State private var winNotes: String = ""
    @State private var recordedWins: [MachineWin] = []

    struct MachineWin: Identifiable {
        let id: UUID = UUID()
        let amount: Double
        let notes: String
        let date: Date
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                heroCard
                statCards
                shipHistoryCard
                sessionCard
                quickActionsCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 100)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle(machine.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    store.toggleFavorite(machine: machine)
                } label: {
                    Image(systemName: machine.isFavorite ? "star.fill" : "star")
                        .foregroundStyle(machine.isFavorite ? EasySeasTheme.gold : EasySeasTheme.textSecondary)
                }
            }
        }
        .sheet(isPresented: $showQuickWinModal) {
            quickWinSheet
                .presentationDetents([.height(340)])
                .presentationContentInteraction(.scrolls)
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: "gamecontroller.fill")
                    .font(.largeTitle)
                    .foregroundStyle(EasySeasTheme.gold)
                    .frame(width: 64, height: 64)
                    .background(EasySeasTheme.navy.opacity(0.08), in: .rect(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 4) {
                    Text(machine.name)
                        .font(.title3.weight(.heavy))
                        .foregroundStyle(.white)
                    Text(machine.manufacturer)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.82))
                }
                Spacer()
                volatilityBadge
            }

            HStack(spacing: 12) {
                detailPill("dollarsign.circle.fill", machine.denominations.joined(separator: ", "))
                detailPill("chart.bar.fill", machine.volatility)
                detailPill("star.fill", machine.isFavorite ? "Favorited" : "Not favorited")
            }
        }
        .padding(16)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 20))
        .cardShadow()
    }

    private var volatilityBadge: some View {
        let color: Color = {
            switch machine.volatility.lowercased() {
            case "high": return Color.red
            case "medium": return Color.orange
            default: return EasySeasTheme.seafoam
            }
        }()
        return Text(machine.volatility.uppercased())
            .font(.caption.weight(.heavy))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.15), in: .capsule)
    }

    private func detailPill(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: symbol)
                .font(.caption2)
            Text(text)
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(.white.opacity(0.9))
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(.white.opacity(0.12), in: .capsule)
    }

    private var statCards: some View {
        HStack(spacing: 10) {
            StatTile(label: "Ships Seen", value: "\(machine.shipsSeen.count)", systemImage: "ferry.fill", color: EasySeasTheme.navy)
            StatTile(label: "Denominations", value: "\(machine.denominations.count)", systemImage: "dollarsign.circle.fill", color: EasySeasTheme.money)
            StatTile(label: "Wins Logged", value: "\(recordedWins.count)", systemImage: "trophy.fill", color: EasySeasTheme.gold)
        }
    }

    private var shipHistoryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Ships Where Spotted", subtitle: "Cruise ships where this machine has been observed.", systemImage: "ferry.fill")

            ForEach(machine.shipsSeen, id: \.self) { ship in
                HStack(spacing: 10) {
                    Image(systemName: "ferry.fill")
                        .foregroundStyle(EasySeasTheme.aqua)
                        .frame(width: 32, height: 32)
                        .background(EasySeasTheme.aqua.opacity(0.1), in: .circle)
                    Text(ship)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(EasySeasTheme.navy)
                    Spacer()
                }
                .padding(10)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var sessionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Machine Strategy", subtitle: "Tips and observations for this machine.", systemImage: "lightbulb.fill")

            VStack(alignment: .leading, spacing: 8) {
                strategyRow("Volatility: \(machine.volatility)", "Match your bankroll to volatility level.")
                strategyRow("Denominations: \(machine.denominations.joined(separator: ", "))", "Lower denom = longer play time. Higher denom = bigger potential wins.")
                strategyRow("Manufacturer: \(machine.manufacturer)", "\(machine.manufacturer) machines are known across \(machine.shipsSeen.count) ship(s) in the fleet.")
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private func strategyRow(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(EasySeasTheme.navy)
            Text(detail)
                .font(.caption)
                .foregroundStyle(EasySeasTheme.textSecondary)
                .lineSpacing(2)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
    }

    private var quickActionsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Quick Actions", subtitle: "Log a win or export machine details.", systemImage: "bolt.fill")

            PrimaryButton(title: "Log Quick Win", systemImage: "dollarsign.circle.fill") {
                showQuickWinModal = true
            }

            if !recordedWins.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Recent Wins").font(.subheadline.weight(.heavy)).foregroundStyle(EasySeasTheme.navy)
                    ForEach(recordedWins) { win in
                        HStack {
                            Text(Formatters.dollars(win.amount))
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(EasySeasTheme.money)
                            if !win.notes.isEmpty {
                                Text(win.notes)
                                    .font(.caption)
                                    .foregroundStyle(EasySeasTheme.textSecondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Text(Formatters.shortDate.string(from: win.date))
                                .font(.caption2)
                                .foregroundStyle(EasySeasTheme.textSecondary)
                        }
                        .padding(8)
                        .background(EasySeasTheme.background, in: .rect(cornerRadius: 10)))
                    }
                }
            }
        }
        .padding(14)
        .background(.white, in: .rect(cornerRadius: 18)))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(EasySeasTheme.border, lineWidth: 1))
    }

    private var quickWinSheet: some View {
        VStack(spacing: 16) {
            Text("Log Quick Win")
                .font(.headline.weight(.heavy))
                .foregroundStyle(EasySeasTheme.navy)

            HStack(spacing: 8) {
                Text("$")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(EasySeasTheme.money)
                TextField("Amount", text: $winAmount)
                    .keyboardType(.decimalPad)
                    .font(.title3)
                    .padding(12)
                    .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))
            }

            TextField("Notes (optional)", text: $winNotes)
                .font(.subheadline)
                .padding(12)
                .background(EasySeasTheme.background, in: .rect(cornerRadius: 12)))

            PrimaryButton(title: "Save Win", systemImage: "checkmark") {
                if let amount = Double(winAmount), amount > 0 {
                    recordedWins.append(MachineWin(amount: amount, notes: winNotes, date: Date()))
                    store.syncLogs.append(SyncLogEntry(kind: .success, message: "Logged \(Formatters.dollars(amount)) win on \(machine.name)"))
                }
                winAmount = ""
                winNotes = ""
                showQuickWinModal = false
            }
        }
        .padding(20)
    }
}
