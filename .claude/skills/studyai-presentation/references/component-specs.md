# Component TypeScript Specifications

> **React Native**: All components use React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`) instead of HTML elements. Styling uses NativeWind (Tailwind classes). Math rendering uses `react-native-math-view` or `WebView` with KaTeX. Icons use `lucide-react-native` or `@expo/vector-icons`. The MathKeypad grid uses `View` with `flexWrap: 'wrap'` (not CSS Grid).

## Solver Components

### MultipleChoiceCard

```typescript
interface MultipleChoiceCardProps {
  question: {
    id: string;
    number: number;
    content: string;        // LaTeX string
    options: string[];      // 5 options with ①②③④⑤ prefix
    points?: number;
  };
  selectedOption: number | null;   // 0-4 index
  onSelect: (index: number) => void;
  showResult?: boolean;
  correctAnswer?: number;          // 0-4 index (shown after submit)
  disabled?: boolean;
}
```

### ShortAnswerInput

```typescript
interface ShortAnswerInputProps {
  value: string;                    // LaTeX answer string
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;            // default: "답을 입력하세요"
  showKeypad?: boolean;            // default: true on mobile
  showResult?: boolean;
  correctAnswer?: string;
  isCorrect?: boolean;
}
```

### MathKeypad

```typescript
interface MathKeypadProps {
  onInput: (value: string) => void;  // LaTeX fragment
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  visible: boolean;
}

// Key definitions
type KeyType = 'number' | 'operator' | 'math' | 'backspace' | 'submit';

interface KeyDef {
  label: string;        // Display text
  value: string;        // LaTeX output
  type: KeyType;
  colSpan?: number;     // default 1
}

// Main grid (5x5)
const mainKeys: KeyDef[][] = [
  [{ label: '7', value: '7', type: 'number' }, { label: '8', value: '8', type: 'number' }, { label: '9', value: '9', type: 'number' }, { label: '÷', value: '\\div ', type: 'operator' }, { label: '⌫', value: '', type: 'backspace' }],
  [{ label: '4', value: '4', type: 'number' }, { label: '5', value: '5', type: 'number' }, { label: '6', value: '6', type: 'number' }, { label: '×', value: '\\times ', type: 'operator' }, { label: '√', value: '\\sqrt{', type: 'math' }],
  [{ label: '1', value: '1', type: 'number' }, { label: '2', value: '2', type: 'number' }, { label: '3', value: '3', type: 'number' }, { label: '−', value: '-', type: 'operator' }, { label: 'x²', value: '^{2}', type: 'math' }],
  [{ label: '0', value: '0', type: 'number' }, { label: '.', value: '.', type: 'number' }, { label: 'π', value: '\\pi ', type: 'math' }, { label: '+', value: '+', type: 'operator' }, { label: 'ⁿ√', value: '\\sqrt[]{', type: 'math' }],
  [{ label: '½', value: '\\frac{}{', type: 'math' }, { label: 'x', value: 'x', type: 'number' }, { label: '(', value: '(', type: 'operator' }, { label: ')', value: ')', type: 'operator' }, { label: '=', value: '=', type: 'submit' }],
];

// Special row (scrollable)
const specialKeys: KeyDef[] = [
  { label: '분수', value: '\\frac{}{}', type: 'math' },
  { label: '루트', value: '\\sqrt{}', type: 'math' },
  { label: '지수', value: '^{}', type: 'math' },
  { label: '절댓값', value: '|', type: 'math' },
  { label: 'log', value: '\\log ', type: 'math' },
  { label: 'sin', value: '\\sin ', type: 'math' },
  { label: 'cos', value: '\\cos ', type: 'math' },
  { label: 'tan', value: '\\tan ', type: 'math' },
];
```

### TimerBar

```typescript
interface TimerBarProps {
  totalSeconds: number;
  remainingSeconds: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  warningThreshold?: number;     // seconds, default: 60 (turn orange)
  criticalThreshold?: number;    // seconds, default: 30 (turn red)
}
```

### QuestionNav

```typescript
interface QuestionNavProps {
  totalQuestions: number;
  currentIndex: number;           // 0-based
  answeredIndices: number[];      // which questions have answers
  onNavigate: (index: number) => void;
}
```

### ResultSummary

```typescript
interface ResultSummaryProps {
  score: number;
  totalPoints: number;
  totalQuestions: number;
  correctCount: number;
  timeSpent: number;              // seconds
  previousScore?: number;         // for comparison
  questions: {
    index: number;
    isCorrect: boolean;
    timeSpent: number;
    errorType?: 'concept_gap' | 'calculation_error' | 'time_pressure';
  }[];
  onShareToFriends: () => void;
  onAddToErrorNote: () => void;
  onRetryWrong: () => void;
}
```

## Diagnosis Components

### ErrorDiagnosisCard

```typescript
interface ErrorDiagnosisCardProps {
  diagnosis: {
    id: string;
    questionNumber: number;
    points: number;
    errorType: 'concept_gap' | 'calculation_error' | 'time_pressure';
    originalContent: string;       // LaTeX
    studentAnswer: string;
    correctAnswer: string;
    reasoning: string;             // Korean
    stepByStep: string;            // Korean with LaTeX
    confidence: number;            // 0.0-1.0
  };
  onStartCorrectionDrill: (diagnosisId: string) => void;
  onFeedback: (diagnosisId: string, rating: 1 | -1) => void;
}
```

### ErrorTypeBadge

```typescript
interface ErrorTypeBadgeProps {
  type: 'concept_gap' | 'calculation_error' | 'time_pressure';
  size?: 'sm' | 'md' | 'lg';
}

// Visual mapping
const errorTypeConfig = {
  concept_gap: { label: '개념 부족', icon: 'book-open', color: '#F43F5E', bg: '#FFF1F2' },
  calculation_error: { label: '계산 실수', icon: 'pencil', color: '#F59E0B', bg: '#FFFBEB' },
  time_pressure: { label: '시간 부족', icon: 'clock', color: '#3B82F6', bg: '#EFF6FF' },
};
```

## Social Components

### FeedCard

```typescript
interface FeedCardProps {
  item: {
    id: string;
    userId: string;
    nickname: string;
    avatarUrl?: string;
    itemType: 'variant_set' | 'error_note' | 'mini_test_result' | 'blueprint';
    caption?: string;
    createdAt: string;
    // Type-specific data
    data: VariantSetData | ErrorNoteData | TestResultData | BlueprintData;
  };
  onSolveNow: (itemId: string) => void;
  onLike: (itemId: string) => void;
  likeCount: number;
  isLiked: boolean;
}

interface VariantSetData {
  unit: string;
  errorType: string;
  questionCount: number;
  difficulty: string;
}

interface ErrorNoteData {
  errorTypes: { type: string; count: number }[];
  units: string[];
  correctionCount: number;
}

interface TestResultData {
  score: number;
  totalQuestions: number;
  correctCount: number;
  unit: string;
}

interface BlueprintData {
  unitDistribution: Record<string, number>;
  totalQuestions: number;
}
```

### FollowButton

```typescript
interface FollowButtonProps {
  userId: string;
  status: 'none' | 'pending' | 'accepted' | 'blocked';
  onFollow: (userId: string) => void;
  onUnfollow: (userId: string) => void;
  onAccept: (userId: string) => void;
  onReject: (userId: string) => void;
}
```

## Parent Dashboard Components

### WeaknessHeatmap

```typescript
interface WeaknessHeatmapProps {
  data: {
    unit: string;
    accuracy: number;    // 0-100
    questionCount: number;
  }[];
}
// Color mapping: <50% = rose, 50-70% = amber, 70-85% = light green, >85% = dark green
```

### ScoreTrendChart

```typescript
interface ScoreTrendChartProps {
  data: {
    date: string;        // ISO date
    score: number;
    totalPoints: number;
    label?: string;      // e.g., "중간고사 전"
  }[];
}
```

### ChildSelector

```typescript
interface ChildSelectorProps {
  children: {
    id: string;
    nickname: string;
    grade: string;
    avatarUrl?: string;
  }[];
  selectedId: string;
  onSelect: (childId: string) => void;
}
```

## Zustand Store Patterns

### useSolverStore

```typescript
interface SolverState {
  testId: string | null;
  questions: VariantQuestion[];
  currentIndex: number;
  answers: Record<number, string>;
  timeRemaining: number;
  totalTime: number;
  isTimerRunning: boolean;
  isComplete: boolean;

  // Actions
  initTest: (testId: string, questions: VariantQuestion[], timeLimit: number) => void;
  setAnswer: (index: number, answer: string) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  tick: () => void;
  toggleTimer: () => void;
  submit: () => void;
  reset: () => void;
}
```

### useAuthStore

```typescript
interface AuthState {
  user: User | null;
  role: 'student' | 'parent' | null;
  isLoading: boolean;
  credits: { total: number; used: number; plan: string } | null;

  setUser: (user: User | null) => void;
  setRole: (role: 'student' | 'parent') => void;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

### useSocialStore

```typescript
interface SocialState {
  feed: FeedItem[];
  isLoading: boolean;
  hasMore: boolean;

  fetchFeed: (page?: number) => Promise<void>;
  shareItem: (itemType: string, itemId: string, caption?: string) => Promise<void>;
  likeItem: (itemId: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  acceptFollow: (followId: string) => Promise<void>;
}
```
