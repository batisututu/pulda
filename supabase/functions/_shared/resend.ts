/**
 * Resend 이메일 게이트웨이 어댑터
 * IEmailGateway 포트 구현 — Supabase Edge Function 전용 (Deno runtime)
 */
import { Resend } from "npm:resend";

export interface WeeklyReportData {
  questionsSolved: number;
  studyTime: number;
  loginDays: number;
  testScores: { date: string; score: number; total: number }[];
  errorDistribution: { type: string; count: number }[];
}

const FROM_EMAIL = "풀다 <noreply@pulda.app>";

function getResendClient(): Resend {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("[ResendEmailGateway] RESEND_API_KEY 환경변수 미설정");
  }
  return new Resend(apiKey);
}

/**
 * 주간 학습 리포트 이메일 발송
 */
export async function sendWeeklyReport(params: {
  parentEmail: string;
  childName: string;
  reportData: WeeklyReportData;
}): Promise<void> {
  const { parentEmail, childName, reportData } = params;
  const resend = getResendClient();

  const scoreRows = reportData.testScores
    .map(
      (s) =>
        `<tr><td>${s.date}</td><td>${s.score}/${s.total}</td><td>${Math.round((s.score / s.total) * 100)}%</td></tr>`,
    )
    .join("");

  const errorRows = reportData.errorDistribution
    .map((e) => `<tr><td>${e.type}</td><td>${e.count}건</td></tr>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>📊 ${childName}님의 주간 학습 리포트</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="background: #f5f5f5;">
      <td style="padding: 12px;"><strong>풀이 문제 수</strong></td>
      <td style="padding: 12px;">${reportData.questionsSolved}문제</td>
    </tr>
    <tr>
      <td style="padding: 12px;"><strong>학습 시간</strong></td>
      <td style="padding: 12px;">${Math.round(reportData.studyTime / 60)}분</td>
    </tr>
    <tr style="background: #f5f5f5;">
      <td style="padding: 12px;"><strong>접속 일수</strong></td>
      <td style="padding: 12px;">${reportData.loginDays}일</td>
    </tr>
  </table>
  ${
    scoreRows
      ? `<h3>최근 테스트 성적</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #e8e8e8;"><th style="padding: 8px;">날짜</th><th>점수</th><th>정답률</th></tr>
      ${scoreRows}
    </table>`
      : ""
  }
  ${
    errorRows
      ? `<h3>오답 유형 분포</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #e8e8e8;"><th style="padding: 8px;">유형</th><th>횟수</th></tr>
      ${errorRows}
    </table>`
      : ""
  }
  <p style="color: #888; font-size: 12px; margin-top: 24px;">풀다 (시험의 신) — AI 시험 분석 서비스</p>
</body>
</html>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: parentEmail,
    subject: `[풀다] ${childName}님의 주간 학습 리포트`,
    html,
  });
}

/**
 * 일반 알림 이메일 발송
 */
export async function sendNotification(params: {
  email: string;
  subject: string;
  body: string;
}): Promise<void> {
  const resend = getResendClient();

  await resend.emails.send({
    from: FROM_EMAIL,
    to: params.email,
    subject: params.subject,
    html: `<div style="font-family: 'Apple SD Gothic Neo', sans-serif; padding: 20px;">${params.body}</div>`,
  });
}
