# Route Integration Snippets

## `expo/app/_layout.tsx`

```tsx
<Stack.Screen 
  name="seapass-generator" 
  options={{ 
    headerShown: true,
  }} 
/>
```

## `expo/app/(tabs)/settings.tsx`

```tsx
{renderSettingRow(
  <Ticket size={18} color="#5A319F" />,
  'SeaPass Web Generator',
  'Locked Version 2 web pass',
  () => router.push('/seapass-generator' as any)
)}
```

## Notes
- The feature currently lives behind the admin section in settings.
- The screen itself still performs its own `isAdmin` gate, so both the navigation placement and screen guard exist.
