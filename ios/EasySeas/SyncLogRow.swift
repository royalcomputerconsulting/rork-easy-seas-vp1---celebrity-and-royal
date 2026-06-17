import SwiftUI

struct SyncLogRow: View {
    let entry: SyncLogEntry

    private var tint: Color {
        switch entry.kind {
        case .info: EasySeasTheme.aqua
        case .step: EasySeasTheme.gold
        case .success: EasySeasTheme.money
        case .warning: .orange
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(tint)
                .frame(width: 9, height: 9)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.message)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(EasySeasTheme.navy)
                Text(entry.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundStyle(EasySeasTheme.textSecondary)
            }
            Spacer()
        }
    }
}
