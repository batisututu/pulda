/**
 * 주간 부모 리포트 크론 Edge Function
 * 매주 월요일 09:00 KST 실행 (pg_cron 또는 외부 트리거)
 *
 * 활성 parent_links 조회 → 각 자녀 주간 통계 집계 → Resend로 이메일 발송
 */
import { createClient } from "npm:@supabase/supabase-js";
import { sendWeeklyReport } from "../_shared/resend.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  try {
    // 인증 확인 (cron 또는 service_role 키 필요)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 활성 parent_links와 부모 이메일, 자녀 닉네임 조회
    const { data: links, error: linkError } = await db
      .from("parent_links")
      .select(
        "parent_user_id, child_user_id, parent:users!parent_user_id(email), child:users!child_user_id(nickname)",
      )
      .eq("status", "active");

    if (linkError) {
      throw new Error(`parent_links 조회 실패: ${linkError.message}`);
    }

    if (!links || links.length === 0) {
      return new Response(
        JSON.stringify({ message: "활성 연동 없음", sent: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const oneWeekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    let sentCount = 0;
    const errors: string[] = [];

    for (const link of links) {
      try {
        const parentEmail = (link as Record<string, unknown>).parent as {
          email: string;
        };
        const childNickname = (link as Record<string, unknown>).child as {
          nickname: string;
        };

        if (!parentEmail?.email) continue;

        const childUserId = link.child_user_id;

        // 2. 자녀의 최근 7일 미니테스트 조회
        const { data: tests } = await db
          .from("mini_tests")
          .select("id, score, total_points, time_spent, completed_at")
          .eq("user_id", childUserId)
          .not("completed_at", "is", null)
          .gte("completed_at", oneWeekAgo);

        const testIds = (tests ?? []).map((t: { id: string }) => t.id);

        // 3. 답안 수 집계
        let questionsSolved = 0;
        if (testIds.length > 0) {
          const { count } = await db
            .from("mini_test_answers")
            .select("*", { count: "exact", head: true })
            .in("test_id", testIds);
          questionsSolved = count ?? 0;
        }

        // 4. 학습 시간 및 접속 일수 계산
        let totalStudyTime = 0;
        const loginDays = new Set<string>();
        for (const test of tests ?? []) {
          totalStudyTime += (test as { time_spent: number | null }).time_spent ?? 0;
          const completedAt = (test as { completed_at: string }).completed_at;
          if (completedAt) {
            loginDays.add(completedAt.slice(0, 10));
          }
        }

        // 5. 테스트 성적
        const testScores = (tests ?? [])
          .filter(
            (t: Record<string, unknown>) =>
              t.score !== null && t.total_points !== null,
          )
          .map((t: Record<string, unknown>) => ({
            date: (t.completed_at as string).slice(0, 10),
            score: t.score as number,
            total: t.total_points as number,
          }));

        // 6. 오답 유형 분포 (최근 7일 진단)
        const { data: diagnoses } = await db
          .from("error_diagnoses")
          .select("error_type, questions!inner(exam_id, exams!inner(user_id))")
          .eq("questions.exams.user_id", childUserId)
          .gte("created_at", oneWeekAgo);

        const errorCountMap = new Map<string, number>();
        for (const d of diagnoses ?? []) {
          const errorType = (d as { error_type: string }).error_type;
          errorCountMap.set(errorType, (errorCountMap.get(errorType) ?? 0) + 1);
        }
        const errorDistribution = Array.from(errorCountMap.entries()).map(
          ([type, count]) => ({ type, count }),
        );

        // 7. 이메일 발송
        await sendWeeklyReport({
          parentEmail: parentEmail.email,
          childName: childNickname?.nickname ?? "자녀",
          reportData: {
            questionsSolved,
            studyTime: totalStudyTime,
            loginDays: loginDays.size,
            testScores,
            errorDistribution,
          },
        });

        sentCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "알 수 없는 에러";
        errors.push(`child=${link.child_user_id}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "주간 리포트 발송 완료",
        sent: sentCount,
        total: links.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
