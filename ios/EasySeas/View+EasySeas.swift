import SwiftUI

extension View {
    func easyGlass(tint: Color = .white, cornerRadius: CGFloat = 20) -> some View {
        modifier(GlassBackport(tint: tint, cornerRadius: cornerRadius))
    }

    func cardShadow() -> some View {
        shadow(color: .black.opacity(0.08), radius: 14, x: 0, y: 8)
    }
}
