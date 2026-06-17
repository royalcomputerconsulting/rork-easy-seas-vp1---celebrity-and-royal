import SwiftUI

enum EasySeasTheme {
    static let navy: Color = Color(red: 30.0 / 255.0, green: 58.0 / 255.0, blue: 95.0 / 255.0)
    static let navyDark: Color = Color(red: 15.0 / 255.0, green: 36.0 / 255.0, blue: 57.0 / 255.0)
    static let navyDeep: Color = Color(red: 8.0 / 255.0, green: 21.0 / 255.0, blue: 38.0 / 255.0)
    static let aqua: Color = Color(red: 0.0 / 255.0, green: 151.0 / 255.0, blue: 167.0 / 255.0)
    static let aquaLight: Color = Color(red: 0.0 / 255.0, green: 172.0 / 255.0, blue: 193.0 / 255.0)
    static let gold: Color = Color(red: 212.0 / 255.0, green: 160.0 / 255.0, blue: 10.0 / 255.0)
    static let goldLight: Color = Color(red: 245.0 / 255.0, green: 158.0 / 255.0, blue: 11.0 / 255.0)
    static let purple: Color = Color(red: 123.0 / 255.0, green: 45.0 / 255.0, blue: 142.0 / 255.0)
    static let seafoam: Color = Color(red: 16.0 / 255.0, green: 185.0 / 255.0, blue: 129.0 / 255.0)
    static let money: Color = Color(red: 5.0 / 255.0, green: 150.0 / 255.0, blue: 105.0 / 255.0)
    static let textSecondary: Color = Color(red: 75.0 / 255.0, green: 85.0 / 255.0, blue: 99.0 / 255.0)
    static let border: Color = Color(red: 229.0 / 255.0, green: 231.0 / 255.0, blue: 235.0 / 255.0)
    static let background: Color = Color(red: 248.0 / 255.0, green: 249.0 / 255.0, blue: 250.0 / 255.0)

    static var nauticalGradient: LinearGradient {
        LinearGradient(
            colors: [navyDeep, navy, aqua.opacity(0.9)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var softCardGradient: LinearGradient {
        LinearGradient(
            colors: [aqua.opacity(0.10), purple.opacity(0.06), gold.opacity(0.06)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
