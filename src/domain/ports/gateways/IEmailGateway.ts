/**
 * 주간 리포트 이메일에 포함될 학습 통계 데이터.
 */
export interface WeeklyReportData {
  questionsSolved: number;
  studyTime: number;                                          // 단위: 분
  loginDays: number;
  testScores: { date: string; score: number; total: number }[];
  errorDistribution: { type: string; count: number }[];
}

/**
 * 이메일 발송 게이트웨이 포트.
 * 구현체는 Edge Function의 _shared/resend.ts에만 존재 (서버 전용 API 키 필요).
 */
export interface IEmailGateway {
  sendWeeklyReport(params: {
    parentEmail: string;
    childName: string;
    reportData: WeeklyReportData;
  }): Promise<void>;

  sendNotification(params: {
    email: string;
    subject: string;
    body: string;
  }): Promise<void>;
}
