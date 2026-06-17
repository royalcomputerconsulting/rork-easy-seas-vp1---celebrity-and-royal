import SwiftUI

struct ProfileEditScreen: View {
    let store: EasySeasStore
    @State private var email: String
    @State private var clubRoyaleText: String
    @State private var crownAnchorText: String
    @State private var selectedBrand: CruiseBrand
    @State private var savedMessage: String = ""

    init(store: EasySeasStore) {
        self.store = store
        _email = State(initialValue: store.memberEmail)
        _clubRoyaleText = State(initialValue: "\(store.clubRoyalePoints)")
        _crownAnchorText = State(initialValue: "\(store.crownAnchorPoints)")
        _selectedBrand = State(initialValue: store.selectedBrand)
    }

    var body: some View {
        Form {
            Section("Profile") {
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                Picker("Primary brand", selection: $selectedBrand) {
                    ForEach(CruiseBrand.allCases) { brand in
                        Text(brand.title).tag(brand)
                    }
                }
            }

            Section("Loyalty Baselines") {
                TextField("Club Royale points", text: $clubRoyaleText)
                    .keyboardType(.numberPad)
                TextField("Crown & Anchor points", text: $crownAnchorText)
                    .keyboardType(.numberPad)
            }

            Section {
                Button {
                    let club = Int(clubRoyaleText.filter(\.isNumber)) ?? store.clubRoyalePoints
                    let crown = Int(crownAnchorText.filter(\.isNumber)) ?? store.crownAnchorPoints
                    store.updateProfile(email: email, clubRoyale: club, crownAnchor: crown)
                    store.setSelectedBrand(selectedBrand)
                    savedMessage = "Saved profile and loyalty values."
                } label: {
                    Label("Save Profile", systemImage: "checkmark.seal.fill")
                        .font(.headline.weight(.heavy))
                }
            }

            if !savedMessage.isEmpty {
                Section {
                    Text(savedMessage)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(EasySeasTheme.money)
                }
            }
        }
        .navigationTitle("Profile")
        .toolbarTitleDisplayMode(.inline)
    }
}
