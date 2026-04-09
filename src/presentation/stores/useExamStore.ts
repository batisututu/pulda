import { create } from 'zustand';
import { supabase } from '@/infrastructure/api/supabaseClient';
import { createUploadExamUseCase, createGetDiagnosisUseCase } from '@/di/container';
import { invokeRunOcr, invokeAnalyzeExam } from '@/infrastructure/api/edgeFunctions';
import type { Exam, Question, Blueprint, ErrorDiagnosis } from '@/domain/entities';
import type { SubjectOrOther } from '@/domain/value-objects/Subject';
import { getServiceTier } from '@/domain/rules/subjectRules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExamDetail {
  exam: Exam;
  questions: Question[];
  diagnoses: ErrorDiagnosis[];
  blueprint: Blueprint | null;
}

interface ExamState {
  exams: Exam[];
  currentExam: ExamDetail | null;
  isLoading: boolean;
  error: string | null;

  fetchExams: () => Promise<void>;
  fetchExamDetail: (id: string) => Promise<void>;
  uploadExam: (imageUri: string, subject: SubjectOrOther) => Promise<string>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 이미지 URI를 File 객체로 변환한다.
 * React Native 환경에서는 fetch로 blob을 읽어 File을 생성한다.
 */
async function uriToFile(uri: string): Promise<File> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const filename = uri.split('/').pop() ?? 'exam.jpg';
  const mimeType = blob.type || 'image/jpeg';
  return new File([blob], filename, { type: mimeType });
}

/**
 * Supabase 행을 Exam 엔티티로 매핑한다.
 */
function mapRowToExam(row: Record<string, unknown>): Exam {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subject: (row.subject as SubjectOrOther) ?? 'math',
    serviceTier: (row.service_tier as Exam['serviceTier']) ?? 'ai_analysis',
    imageUrl: (row.image_url as string) ?? null,
    ocrResult: (row.ocr_result as Exam['ocrResult']) ?? null,
    status: (row.status as Exam['status']) ?? 'processing',
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useExamStore = create<ExamState>((set, get) => ({
  exams: [],
  currentExam: null,
  isLoading: false,
  error: null,

  fetchExams: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const exams = (data ?? []).map(mapRowToExam);
      set({ exams, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '시험지 목록을 불러올 수 없습니다.';
      set({ error: message, isLoading: false });
    }
  },

  fetchExamDetail: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      // 병렬로 exam, questions, diagnoses, blueprint 조회
      const [examRes, questionsRes, diagnosesRes, blueprintRes] = await Promise.all([
        supabase
          .from('exams')
          .select('*')
          .eq('id', id)
          .eq('user_id', session.user.id)
          .single(),
        supabase
          .from('questions')
          .select('*')
          .eq('exam_id', id)
          .order('number', { ascending: true }),
        supabase
          .from('error_diagnoses')
          .select('*')
          .eq('question_id', id), // will be joined via question_ids below
        supabase
          .from('blueprints')
          .select('*')
          .eq('exam_id', id)
          .maybeSingle(),
      ]);

      if (examRes.error) throw new Error(examRes.error.message);
      if (!examRes.data) throw new Error('시험지를 찾을 수 없습니다.');

      const exam = mapRowToExam(examRes.data as Record<string, unknown>);

      const questions: Question[] = (questionsRes.data ?? []).map((row) => ({
        id: row.id,
        examId: row.exam_id,
        subject: row.subject ?? exam.subject,
        number: row.number,
        content: row.content,
        questionType: row.question_type,
        options: row.options ?? null,
        answer: row.answer ?? null,
        studentAnswer: row.student_answer ?? null,
        isCorrect: row.is_correct ?? null,
        points: row.points ?? null,
        createdAt: row.created_at,
      }));

      // 문항 ID 목록으로 오답 진단 재조회
      const questionIds = questions.map((q) => q.id);
      let diagnoses: ErrorDiagnosis[] = [];
      if (questionIds.length > 0) {
        const { data: diagData } = await supabase
          .from('error_diagnoses')
          .select('*')
          .in('question_id', questionIds);

        diagnoses = (diagData ?? []).map((row) => ({
          id: row.id,
          questionId: row.question_id,
          errorType: row.error_type,
          confidence: row.confidence,
          reasoning: row.reasoning,
          correction: row.correction,
          stepByStep: row.step_by_step ?? null,
          verificationResult: row.verification_result ?? null,
          visualExplanation: row.visual_explanation ?? null,
          createdAt: row.created_at,
        }));
      }

      const bpRow = blueprintRes.data;
      const blueprint: Blueprint | null = bpRow
        ? {
            id: bpRow.id,
            examId: bpRow.exam_id,
            unitDistribution: bpRow.unit_distribution,
            typeDistribution: bpRow.type_distribution,
            difficultyDistribution: bpRow.difficulty_distribution,
            insights: bpRow.insights ?? null,
            createdAt: bpRow.created_at,
          }
        : null;

      set({
        currentExam: { exam, questions, diagnoses, blueprint },
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '시험지 상세 정보를 불러올 수 없습니다.';
      set({ error: message, isLoading: false });
    }
  },

  uploadExam: async (imageUri: string, subject: SubjectOrOther): Promise<string> => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const file = await uriToFile(imageUri);
      const useCase = createUploadExamUseCase();
      const result = await useCase.execute({
        userId: session.user.id,
        file,
        subject,
      });

      // OCR → 분석 파이프라인 트리거 (비동기)
      // OCR 성공 시 자동으로 analyze-exam을 호출하여 전체 파이프라인을 연결한다.
      invokeRunOcr(result.examId)
        .then(() => invokeAnalyzeExam(result.examId))
        .catch((pipelineErr) => {
          // 파이프라인 에러를 스토어에 반영하여 UI에서 표시
          const message = pipelineErr instanceof Error ? pipelineErr.message : '분석 파이프라인 오류';
          set({ error: message });
          // 시험지 목록 새로고침으로 error 상태 반영
          get().fetchExams();
        });

      // 업로드된 시험지를 낙관적으로 목록 맨 앞에 추가한다.
      // 전체 fetchExams() 재조회를 피해 불필요한 네트워크 왕복을 없앤다.
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const optimisticExam: Exam = {
        id: result.examId,
        userId: session.user.id,
        subject,
        serviceTier: getServiceTier(subject),
        imageUrl: null,
        ocrResult: null,
        status: 'processing',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
      };

      set((state) => ({
        exams: [optimisticExam, ...state.exams],
        isLoading: false,
      }));
      return result.examId;
    } catch (err) {
      const message = err instanceof Error ? err.message : '시험지 업로드에 실패했습니다.';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useExamStore;
