# Easy Seas v1001 — Crew Sailing Assignment + Survey List Fix QA

- App version: 9.11.01
- Build number: 9.11.01

## Primary fix
Crew recognition import now treats every pasted ship/date header as a real sailing assignment boundary. A pasted block such as:

```text
Quantum of the Seas 6/19
Shairene - public area cleaner
Yulfikar - stateroom attendant 9118

Allure of the Seas 10/17/2026
Marly - bartender
Maria Jose - front desk
```

creates two separate sailings and assigns each crew member to the correct ship/date instead of importing later ship/date headers as fake crew names.

## Survey List behavior
- If filters are active, Survey List uses the filtered crew list.
- If no filters are active, Survey List still asks the user to choose a sailing.
- The chosen sailing now represents the app's stored ship/date assignment, not a random text name from the pasted list.
- Crew entries are retained with `sailingId`, `shipName`, `sailStartDate`, `sailEndDate`, `sailingMonth`, and `sailingYear`.

## Data cleanup
- On load, Easy Seas removes previously mis-imported rows where a ship/date header was accidentally saved as a crew name.
- Duplicate detection is now scoped by ship + sailing date + crew name + role + department.

## Export support
- Crew page size increased so Survey List and Export Results have access to the full local crew set instead of only the first 50 rows.
