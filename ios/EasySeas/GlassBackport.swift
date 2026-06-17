import SwiftUI

struct GlassBackport: ViewModifier {
    var tint: Color = .white
    var cornerRadius: CGFloat = 20

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.tint(tint.opacity(0.16)), in: .rect(cornerRadius: cornerRadius))
        } else {
            content
                .background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        }
    }
}
