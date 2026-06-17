import SwiftUI

struct PrimaryButton: View {
    let title: String
    var systemImage: String? = nil
    var isLoading: Bool = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(.subheadline.weight(.heavy))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 16))
            .shadow(color: EasySeasTheme.navy.opacity(0.22), radius: 12, x: 0, y: 7)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}
