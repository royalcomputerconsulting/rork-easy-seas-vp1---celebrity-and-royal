# Current System Snapshot

## Feature route
- Public route path in app router: `/seapass-generator`
- Registered in: `expo/app/_layout.tsx`
- Admin navigation entry lives in: `expo/app/(tabs)/settings.tsx`

## Core files currently powering the feature
- `expo/app/seapass-generator.tsx`
- `expo/components/seapass/SeaPassWebPass.tsx`
- `expo/lib/seaPassWebPass.ts`
- `expo/lib/seapassExport.ts`
- `expo/lib/seapassExport.web.ts`

## Supporting files used directly by the current implementation
- `expo/components/ErrorBoundary.tsx`
- `expo/constants/theme.ts`
- `expo/backend/hono.ts`
- `expo/app/_layout.tsx`
- `expo/app/(tabs)/settings.tsx`
- `expo/package.json`
- `expo/tsconfig.json`
- `tsconfig.json`

## Editable SeaPass fields
The generator currently edits these runtime values:
- `time`
- `date`
- `deck`
- `stateroom`
- `muster`
- `reservation`
- `ship`

## Locked visual/content elements baked into the shell workflow
Defined in `expo/lib/seaPassWebPass.ts`:
- Name lines: `Scott`, `Merlis`
- Status line: `DIAMOND PLUS • SIGNATURE`
- Port line: `LOS ANGELES, CALIFORNIA`
- Legal lines:
  - `Due to government regulations, all guests are`
  - `required to be at the pier and checked in no later`
  - `than 90 minutes prior to the sail time.`

## Default data
- `time: 10:30 am`
- `date: Apr 07`
- `deck: 10`
- `stateroom: 10134`
- `muster: A4`
- `reservation: 182213`
- `ship: QN`

## Environment variables available in the project at snapshot time
- `EXPO_PUBLIC_RORK_DB_ENDPOINT`
- `EXPO_PUBLIC_RORK_DB_NAMESPACE`
- `EXPO_PUBLIC_RORK_DB_TOKEN`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- `EXPO_PUBLIC_RORK_AUTH_URL`
- `EXPO_PUBLIC_RORK_API_BASE_URL`
- `EXPO_PUBLIC_TOOLKIT_URL`
- `EXPO_PUBLIC_PROJECT_ID`
- `EXPO_PUBLIC_TEAM_ID`

## Environment variable actually used by this feature
- `EXPO_PUBLIC_RORK_API_BASE_URL`
  - Used to build the approved SeaPass shell proxy URL.

## Backend dependency
The backend exposes a proxy route for the approved SeaPass shell image:
- Current implementation path: `expo/backend/hono.ts`
- Current endpoint: `GET /seapass-approved-shell`

## Package dependencies used by this feature
From `expo/package.json`:
- `expo`
- `expo-print`
- `expo-sharing`
- `expo-router`
- `lucide-react-native`
- `react-native-svg`
- `react-native-view-shot`
- `react-native`
- `react`
- `react-native-web`

## Web behavior
- SVG markup is generated in `seaPassWebPass.ts`.
- Web PNG export loads the approved shell image as a data URL, draws the SVG on canvas, and triggers download.
- Web PDF export opens a print dialog using generated HTML.

## Native behavior
- PNG export captures a hidden full-size render target using `captureRef`.
- PDF export renders HTML using `expo-print` and then shares or prints the file.

## Auth dependency note
The screen is admin-only and depends on `useAuth().isAdmin` from the app auth provider. The exact screen file is included in this folder; auth integration is described in `REBUILD_GUIDE.md`.
