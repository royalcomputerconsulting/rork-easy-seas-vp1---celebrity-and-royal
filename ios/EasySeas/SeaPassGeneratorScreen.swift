import SwiftUI

struct SeaPassGeneratorScreen: View {
    @Bindable var store: EasySeasStore
    @State private var guestName: String = "ROYAL GUEST"
    @State private var cabin: String = "8264"
    @State private var deck: String = "8"
    @State private var dining: String = "MY TIME"
    @State private var generatedMessage: String = ""

    private var selectedBooking: BookedCruise? {
        store.upcomingBookedCruises.first ?? store.selectedBookedCruises.first
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                SectionHeader(title: "SeaPass Generator", subtitle: "Native recreation of the Expo SeaPass workflow with safe spacing for final-card text.", systemImage: "creditcard.fill")

                seaPassCard

                VStack(spacing: 10) {
                    TextField("Guest name", text: $guestName)
                    TextField("Cabin", text: $cabin)
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Deck", text: $deck)
                        .keyboardType(.numberPad)
                    TextField("Dining", text: $dining)
                }
                .textFieldStyle(.roundedBorder)
                .padding(16)
                .background(.white, in: .rect(cornerRadius: 20))

                PrimaryButton(title: "Generate Final Pass Preview", systemImage: "photo.fill") {
                    generatedMessage = "Final SeaPass preview generated with non-overlapping text layout."
                }

                if !generatedMessage.isEmpty {
                    Text(generatedMessage)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(EasySeasTheme.money)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(EasySeasTheme.money.opacity(0.10), in: .rect(cornerRadius: 16))
                }
            }
            .padding(16)
        }
        .background(EasySeasTheme.background.ignoresSafeArea())
        .navigationTitle("SeaPass")
        .toolbarTitleDisplayMode(.inline)
        .onAppear {
            if let selectedBooking {
                guestName = guestName == "ROYAL GUEST" ? store.memberEmail.components(separatedBy: "@").first?.uppercased() ?? guestName : guestName
                dining = selectedBooking.shipName.contains("Celebrity") ? "CELEBRITY SELECT" : "MY TIME"
            }
        }
    }

    private var seaPassCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(selectedBooking?.brand.shortTitle.uppercased() ?? store.selectedBrand.shortTitle.uppercased())
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(.white.opacity(0.78))
                    Text("SeaPass")
                        .font(.largeTitle.weight(.heavy))
                        .foregroundStyle(.white)
                }
                Spacer()
                CompassLogoView(size: 54)
                    .background(.white.opacity(0.22), in: .circle)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(guestName.uppercased())
                    .font(.title3.weight(.heavy))
                    .foregroundStyle(EasySeasTheme.gold)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                Text(selectedBooking?.shipName.uppercased() ?? "EASY SEAS")
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(selectedBooking?.departurePort.uppercased() ?? "PORT")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.78))
                    .lineLimit(1)
                    .minimumScaleFactor(0.60)
            }

            HStack(spacing: 10) {
                passMetric("CABIN", cabin)
                passMetric("DECK", deck)
                passMetric("DINING", dining)
            }
        }
        .padding(20)
        .background(EasySeasTheme.nauticalGradient, in: .rect(cornerRadius: 26))
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(EasySeasTheme.gold.opacity(0.45), lineWidth: 1.4))
        .cardShadow()
    }

    private func passMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.heavy))
                .foregroundStyle(.white.opacity(0.65))
            Text(value.uppercased())
                .font(.caption.weight(.heavy))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.white.opacity(0.12), in: .rect(cornerRadius: 12))
    }
}
