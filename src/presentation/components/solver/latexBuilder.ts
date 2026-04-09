/**
 * LaTeX 수식 문자열 조작 순수 함수 모음
 * UI 컴포넌트에 의존하지 않으므로 단독으로 테스트 가능
 */

// ---------------------------------------------------------------------------
// 내부 상수
// ---------------------------------------------------------------------------

/**
 * 스마트 백스페이스용 LaTeX 명령어+중괄호 패턴
 * \\command{...}{...} 또는 ^{...} 형태 전체를 하나의 토큰으로 처리
 * 캐럿(^)은 역슬래시 명령어가 아니므로 별도로 처리
 */
const LATEX_COMMAND_WITH_BRACES = /((?:\\[a-zA-Z]+|\^)(?:\{[^}]*\})+)$/;

/**
 * 공백 포함 LaTeX 명령어 패턴 (예: \\div , \\times )
 */
const LATEX_COMMAND_PLAIN = /(\\[a-zA-Z]+\s*)$/;

// ---------------------------------------------------------------------------
// 공개 함수
// ---------------------------------------------------------------------------

/**
 * 수식 끝에 단일 문자 또는 LaTeX 명령어 문자열을 추가한다
 * 숫자, 연산자(+, -, ...), 직접 명령어(\\div , \\times ) 모두 처리
 */
export function appendChar(expr: string, char: string): string {
  return expr + char;
}

/**
 * 수식 끝에 구조 템플릿을 삽입한다
 * 예: \\sqrt{}, ^{}, \\frac{}{}
 * 가상 키패드이므로 커서 위치 조정 없이 전체 템플릿을 그대로 추가
 */
export function insertTemplate(expr: string, template: string): string {
  return expr + template;
}

/**
 * 부호를 토글한다
 * - 수식이 '-'로 시작하면 제거
 * - 그렇지 않으면 '-'를 앞에 추가
 */
export function toggleSign(expr: string): string {
  if (expr.startsWith('-')) {
    return expr.slice(1);
  }
  return '-' + expr;
}

/**
 * 마지막 논리 토큰을 삭제한다 (스마트 백스페이스)
 *
 * 삭제 우선순위:
 * 1. \\command{...}{...} 형태 전체 (예: \\sqrt{4}, \\frac{1}{2}, ^{2})
 * 2. \\command 단독 형태 (예: \\div , \\times )
 * 3. 단일 문자
 */
export function smartBackspace(expr: string): string {
  // 빈 문자열이면 아무것도 하지 않음
  if (expr.length === 0) return expr;

  // 우선순위 1: 중괄호를 포함하는 LaTeX 명령어 전체 삭제
  const commandWithBracesMatch = expr.match(LATEX_COMMAND_WITH_BRACES);
  if (commandWithBracesMatch) {
    return expr.slice(0, expr.length - commandWithBracesMatch[0].length);
  }

  // 우선순위 2: 공백 포함 LaTeX 명령어 삭제 (예: \\div , \\times )
  const commandPlainMatch = expr.match(LATEX_COMMAND_PLAIN);
  if (commandPlainMatch) {
    return expr.slice(0, expr.length - commandPlainMatch[0].length);
  }

  // 우선순위 3: 마지막 단일 문자 삭제
  return expr.slice(0, -1);
}
