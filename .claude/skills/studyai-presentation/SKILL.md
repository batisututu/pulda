---
name: studyai-presentation
description: |
  Expo Router + React Native presentation layer for StudyAI (풀다) — screens, NativeWind styling, native navigation, Expo APIs, Zustand stores, and accessibility for the Korean math exam prep mobile app.
---

# StudyAI Presentation Layer (Mobile)

## Clean Architecture Rules for Presentation

1. **Components NEVER import from infrastructure.** No direct Supabase client calls in screens or components. Exception: Supabase Auth for session management and Supabase Realtime for subscriptions.
2. **Screens invoke use cases through the DI container** for client-safe operations, or call **Supabase Edge Functions** for server-side operations (AI pipeline, payment webhooks).
3. **Zustand stores hold presentation state only.** UI-specific concerns — current question index, timer ticking, keypad visibility, modal open/close — belong in stores. Persisted domain data (user profile, exam records) is fetched through use case invocations.
4. **Components reference domain entity types.** Shared TypeScript interfaces (`Question`, `Diagnosis`, `FeedItem`, etc.) are imported from a domain types module.

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Framework | React Native 0.83 + Expo ~55 | Native mobile runtime |
| Routing | Expo Router ~55 | File-based routing in `app/` directory |
| Styling | NativeWind ^4.2 (Tailwind for RN) | Utility-first mobile styling |
| State | Zustand ^5 | Lightweight client-side presentation state |
| Math Rendering | react-native-math-view or WebView + KaTeX | LaTeX math rendering on mobile |
| Camera | expo-camera ~55 | Exam photo capture |
| Image Picker | expo-image-picker ~55 | Gallery selection |
| Secure Storage | expo-secure-store ~55 | Auth tokens, sensitive data |
| Local DB | expo-sqlite ~55 | Offline exam session persistence |
| Notifications | expo-notifications ~55 | Push notifications |

## Project Structure

```
app/                            # Expo Router file-based routing
├── _layout.tsx                 # Root layout (Stack navigator, providers, NativeWind)
├── (auth)/                     # Auth flow screens
│   ├── _layout.tsx             # Auth stack layout
│   └── login.tsx               # Login/signup screen
├── (tabs)/                     # Main tab navigator
│   ├── _layout.tsx             # Tab bar layout (Home, Upload, Social, My)
│   ├── index.tsx               # Home / exam list
│   ├── upload.tsx              # Exam upload (camera/gallery)
│   ├── social.tsx              # Social feed
│   └── my.tsx                  # Profile/settings
├── exam/[id]/                  # Exam detail screens (stack)
│   ├── verify.tsx              # Question verification
│   ├── blueprint.tsx           # Exam blueprint
│   └── diagnosis.tsx           # Error diagnosis
├── solve/[testId].tsx          # Mini test solving
├── solve/[testId]/result.tsx   # Mini test results
├── parent/
│   └── dashboard.tsx           # Parent dashboard
├── link/
│   ├── code.tsx                # Link code display (child)
│   └── enter.tsx               # Link code entry (parent)
├── onboarding/
│   ├── index.tsx               # Welcome + features
│   └── role.tsx                # Role selection (student/parent)
└── notifications.tsx           # Notification list

src/presentation/
├── components/
│   ├── solver/                 # MultipleChoiceCard, ShortAnswerInput, MathKeypad, TimerBar, QuestionNav
│   ├── diagnosis/              # ErrorDiagnosisCard, ErrorTypeBadge
│   ├── social/                 # FeedCard, FollowButton, ShareSheet
│   ├── parent/                 # WeaknessHeatmap, ScoreTrendChart, ChildSelector
│   ├── common/                 # Button, Card, Badge, Modal, Skeleton, Toast (React Native)
│   └── layout/                 # TabBar, Header
├── stores/
│   ├── useSolverStore.ts       # Test solving state
│   ├── useAuthStore.ts         # Auth state
│   └── useSocialStore.ts       # Social feed state
├── hooks/
│   ├── useMathRenderer.ts      # LaTeX rendering hook (WebView or math-view)
│   ├── useTimer.ts             # Interval-based countdown
│   ├── useOffline.ts           # NetInfo-based network detection
│   └── useCamera.ts            # Camera/image picker wrapper
└── theme.ts                    # NativeWind design tokens
```

## Design System Tokens

### NativeWind Config

```js
// tailwind.config.ts (used by NativeWind)
module.exports = {
  content: ['./app/**/*.{tsx,ts}', './src/**/*.{tsx,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5', // Deep Indigo
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
        },
        secondary: {
          DEFAULT: '#F97316', // Coral Orange
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
        },
        accent: {
          DEFAULT: '#10B981', // Emerald Green
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        alert: {
          DEFAULT: '#F43F5E', // Rose Red
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
        },
        error: {
          concept: '#F43F5E',   // Rose — concept_gap
          calc: '#F59E0B',      // Amber — calculation_error
          time: '#3B82F6',      // Blue — time_pressure
        },
      },
      borderRadius: {
        card: '16px',
        button: '12px',
        badge: '8px',
        pill: '9999px',
        keypad: '10px',
      },
      fontFamily: {
        sans: ['Pretendard', 'System'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
};
```

### React Native Shadow Pattern

```typescript
// NativeWind handles basic shadows. For custom shadows:
// Android: elevation property
// iOS: shadow* properties
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  android: { elevation: 3 },
});
```

## Key Patterns

### Math Rendering (React Native)

```tsx
// Option A: WebView-based KaTeX (recommended for complex math)
import { WebView } from 'react-native-webview';

function MathBlock({ latex, display = false }: { latex: string; display?: boolean }) {
  const html = `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.js"></script>
      <style>body { margin: 0; display: flex; justify-content: center; font-size: 16px; }</style>
    </head><body>
      <div id="math"></div>
      <script>
        katex.render(${JSON.stringify(latex)}, document.getElementById('math'), {
          displayMode: ${display}, throwOnError: false
        });
      </script>
    </body></html>`;
  return <WebView source={{ html }} style={{ height: display ? 80 : 40 }} scrollEnabled={false} />;
}

// Option B: react-native-math-view (native renderer, lighter)
import MathView from 'react-native-math-view';
function MathBlock({ latex }: { latex: string }) {
  return <MathView math={latex} />;
}
```

### MathKeypad (5x5 Grid)

The keypad is a bottom sheet with a 5-column by 5-row main grid plus a horizontally scrollable special-key row above it. Uses React Native `View` with flexbox (not CSS Grid).

```
Special row (ScrollView horizontal): 분수 | 루트 | 지수 | 절댓값 | log | sin | cos | tan

Main 5x5 grid (View flexWrap):
  7   8   9   ÷   ⌫
  4   5   6   ×   √
  1   2   3   −   x²
  0   .   π   +   ⁿ√
  ½   x   (   )   =
```

Key styling:
- Numbers: white bg `#FFFFFF`, dark text
- Operators: light indigo bg `#EEF2FF`
- Math special: light coral bg `#FFF7ED`
- Backspace: rose bg `#FFF1F2`
- Each key: `minWidth: 44, minHeight: 44` (touch target)
- Use `Pressable` with `hitSlop` for comfortable tapping

### Screen-to-UseCase Pattern

```tsx
// app/(tabs)/upload.tsx — Direct DI container invocation
import { container } from '@/infrastructure/di/container';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

export default function UploadScreen() {
  const handleUpload = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled) return;

    const useCase = container.createUploadExamUseCase();
    const exam = await useCase.execute({
      userId: currentUser.id,
      imageUri: result.assets[0].uri,
    });
    router.push(`/exam/${exam.id}/verify`);
  };

  return (
    <View className="flex-1 bg-slate-50 items-center justify-center p-5">
      <Pressable onPress={handleUpload} className="bg-secondary-500 rounded-xl px-8 py-4">
        <Text className="text-white font-semibold text-base">시험지 촬영</Text>
      </Pressable>
    </View>
  );
}
```

For server-side operations (AI pipeline):
```tsx
// Calling Supabase Edge Function
const { data, error } = await supabase.functions.invoke('analyze-exam', {
  body: { examId: exam.id },
});
```

### Timer (Zustand useSolverStore)

```tsx
// In useSolverStore
tick: () => set((s) => {
  if (!s.isTimerRunning || s.timeRemaining <= 0) return s;
  const next = s.timeRemaining - 1;
  return { timeRemaining: next, isComplete: next <= 0 };
}),
```

Timer color thresholds:
- Normal (> 60s remaining): primary indigo
- Warning (30-60s): secondary orange
- Critical (< 30s): alert rose + pulse animation (via `react-native-reanimated`)

### Offline Support

- **expo-sqlite** for persisting active exam sessions locally
- **Zustand persist** middleware with `expo-secure-store` as storage adapter
- **@react-native-community/netinfo** for network status detection
- Offline banner: `<Text className="text-center text-sm text-slate-500 py-2">오프라인 모드 — 저장된 문제를 풀 수 있어요</Text>`
- Answer sync queue for pending submissions when connectivity restores

## Mobile Layout

This is a mobile-only app targeting iOS and Android.

- **Screen width**: 320–428px (iPhone SE to iPhone Pro Max)
- **All layouts**: Single-column
- **Navigation**: Bottom tab bar (4 tabs: Home, Upload, Social, My) + Stack navigation for detail flows
- **Minimum touch target**: 44x44 points on all interactive elements
- **Safe areas**: Use `useSafeAreaInsets()` from `react-native-safe-area-context`
- **Keyboard**: Use `KeyboardAvoidingView` for input screens

## UI Screen to Route Mapping

| # | Screen | Route File | Frame ID |
|---|--------|-----------|----------|
| 1 | Home / Exam List | `app/(tabs)/index.tsx` | — |
| 2 | Exam Upload | `app/(tabs)/upload.tsx` | `OC4JE` |
| 3 | Question Verification | `app/exam/[id]/verify.tsx` | `GXbHx` |
| 4 | Exam Blueprint | `app/exam/[id]/blueprint.tsx` | `aCW8X` |
| 5 | Error Diagnosis | `app/exam/[id]/diagnosis.tsx` | `7Roux` |
| 6 | MC Solving | `app/solve/[testId].tsx` (type=mc) | `xGmv0` |
| 7 | Math Keypad | `app/solve/[testId].tsx` (type=short) | `bI67Q` |
| 8 | Mini Test Results | `app/solve/[testId]/result.tsx` | `3do98` |
| 9 | Parent Dashboard | `app/parent/dashboard.tsx` | `aNW43` |
| 10 | Social Feed | `app/(tabs)/social.tsx` | `ZN9DE` |
| 11 | Follow Search | `app/social/search.tsx` | `dm9DB` |
| 12 | Profile Stats | `app/(tabs)/my.tsx` | `8nTHB` |
| 13a | Link - Code (child) | `app/link/code.tsx` | `vvoE0` |
| 13b | Link - Enter (parent) | `app/link/enter.tsx` | `Gyoc2` |
| 14 | Notifications | `app/notifications.tsx` | `AUq3k` |
| 15a | Onboarding 1 | `app/onboarding/index.tsx` | `KLIE4` |
| 15b | Onboarding 2 | `app/onboarding/role.tsx` | `nLYpt` |

To inspect a frame in the Pencil design file: `batch_get(filePath: "ui", nodeIds: ["<Frame ID>"])`

## Error Type Visual Language

Each error type is **always** represented with both color and icon together. Never use color alone.

| Error Type | Key | Color | Background | Icon | Label |
|-----------|-----|-------|------------|------|-------|
| Concept Gap | `concept_gap` | Rose `#F43F5E` | `#FFF1F2` | `book-open` | 개념 부족 |
| Calculation Error | `calculation_error` | Amber `#F59E0B` | `#FFFBEB` | `pencil` | 계산 실수 |
| Time Pressure | `time_pressure` | Blue `#3B82F6` | `#EFF6FF` | `clock` | 시간 부족 |

Usage rules:
- Diagnosis cards have a left border in the error type color (use `borderLeftWidth: 4, borderLeftColor`).
- Badges show icon + label on the colored background.
- Charts and pie slices use the primary color for each type.
- Always pair color with icon for accessibility (color-blind safe).
- Icons: use `lucide-react-native` or `@expo/vector-icons`.

## Micro-Interaction Specs

Use `react-native-reanimated` for performant animations:

| Interaction | Trigger | Animation | Duration | Easing |
|------------|---------|-----------|----------|--------|
| Button press | `Pressable` active | `scale(0.97)` via `withSpring` | ~100ms | spring |
| Card tap | `Pressable` active | `scale(0.98)` + elevation change | ~120ms | spring |
| Answer select | tap option | Previous fades, new scales up + indigo border | 200ms | ease-in-out |
| Correct reveal | after submit | Green border + checkmark fade-in + confetti (react-native-confetti-cannon) | 400ms | spring |
| Wrong reveal | after submit | Red border + horizontal shake (3px, 3 cycles) + X icon | 400ms | ease-in-out |
| Score rollup | results load | Number counts up from 0 | 1200ms | decelerate |
| Skeleton | loading | Shimmer via `react-native-skeleton-placeholder` | 1500ms loop | linear |
| Stagger-in | list load | FlatList items fade in + translate up 12px, staggered 60ms | 300ms each | ease-out |

## Korean Typography & Accessibility

### Language & Text

- Use `accessibilityLanguage="ko"` on root View.
- React Native `<Text>` handles Korean word wrapping natively (no `word-break` needed).
- Line height: `lineHeight: 24` for body (1.6x at 15px), `lineHeight: 28` for headings (1.3x).

### Minimum Font Sizes

| Context | Minimum Size |
|---------|-------------|
| Body text | 14px |
| Math expressions | 16px |
| Button labels | 14px |
| Badge / caption | 12px |
| Heading (screen title) | 20px |

### Accessibility

- **WCAG AA contrast ratio**: minimum 4.5:1 for normal text, 3:1 for large text.
- All interactive elements: `accessible={true}`, `accessibilityRole="button"` / `"header"` / etc.
- Icons: `accessibilityLabel` in Korean (e.g., `accessibilityLabel="나누기"` for division key).
- Color is never the sole differentiator — always paired with icon, label, or pattern.
- Support `allowFontScaling` for system-level text size preferences.
- Animations respect `useReducedMotion()` from reanimated — disable or simplify when active.
