/**
 * latexBuilder 순수 함수 단위 테스트
 * React Native 의존성 없음 — node 환경에서 직접 실행 가능
 */

import { describe, it, expect } from 'vitest';
import {
  appendChar,
  insertTemplate,
  toggleSign,
  smartBackspace,
} from './latexBuilder';

// ---------------------------------------------------------------------------
// appendChar
// ---------------------------------------------------------------------------

describe('appendChar', () => {
  it('빈 문자열에 숫자를 추가한다', () => {
    expect(appendChar('', '7')).toBe('7');
  });

  it('기존 수식 끝에 문자를 추가한다', () => {
    expect(appendChar('12', '3')).toBe('123');
  });

  it('LaTeX 명령어 문자열을 그대로 추가한다', () => {
    expect(appendChar('3', '\\div ')).toBe('3\\div ');
  });

  it('여러 문자 추가를 연속으로 처리한다', () => {
    const result = ['1', '+', '2'].reduce(appendChar, '');
    expect(result).toBe('1+2');
  });

  it('연산자 기호를 추가한다', () => {
    expect(appendChar('x', '+')).toBe('x+');
    expect(appendChar('x', '-')).toBe('x-');
    expect(appendChar('x', '(')).toBe('x(');
    expect(appendChar('x', ')')).toBe('x)');
    expect(appendChar('x', '.')).toBe('x.');
  });

  it('\\times 명령어를 추가한다', () => {
    expect(appendChar('3', '\\times ')).toBe('3\\times ');
  });
});

// ---------------------------------------------------------------------------
// insertTemplate
// ---------------------------------------------------------------------------

describe('insertTemplate', () => {
  it('빈 수식에 \\sqrt{} 템플릿을 삽입한다', () => {
    expect(insertTemplate('', '\\sqrt{}')).toBe('\\sqrt{}');
  });

  it('기존 수식 뒤에 \\sqrt{} 템플릿을 삽입한다', () => {
    expect(insertTemplate('3+', '\\sqrt{}')).toBe('3+\\sqrt{}');
  });

  it('^{} 템플릿을 삽입한다 (xⁿ 버튼)', () => {
    expect(insertTemplate('x', '^{}')).toBe('x^{}');
  });

  it('^{2} 를 추가한다 (x² 버튼 — appendChar 사용)', () => {
    // x² 버튼은 template 없이 latex: '^{2}' 를 appendChar 로 처리
    expect(appendChar('x', '^{2}')).toBe('x^{2}');
  });

  it('\\frac{}{} 템플릿을 삽입한다 (⅟ 버튼)', () => {
    expect(insertTemplate('', '\\frac{}{}')).toBe('\\frac{}{}');
  });

  it('복합 수식 뒤에 \\frac{}{} 템플릿을 삽입한다', () => {
    expect(insertTemplate('2+', '\\frac{}{}')).toBe('2+\\frac{}{}');
  });
});

// ---------------------------------------------------------------------------
// toggleSign
// ---------------------------------------------------------------------------

describe('toggleSign', () => {
  it('빈 문자열에 음수 부호를 추가한다', () => {
    expect(toggleSign('')).toBe('-');
  });

  it('양수 수식 앞에 음수 부호를 추가한다', () => {
    expect(toggleSign('42')).toBe('-42');
  });

  it('음수 수식에서 부호를 제거한다', () => {
    expect(toggleSign('-42')).toBe('42');
  });

  it('-로 시작하는 복잡한 수식에서 부호를 제거한다', () => {
    expect(toggleSign('-\\sqrt{4}')).toBe('\\sqrt{4}');
  });

  it('양수 수식에 부호를 추가할 때 수식 내용을 보존한다', () => {
    expect(toggleSign('\\frac{1}{2}')).toBe('-\\frac{1}{2}');
  });

  it('두 번 토글하면 원래 값으로 돌아온다', () => {
    const original = '3+5';
    expect(toggleSign(toggleSign(original))).toBe(original);
  });

  it('단일 마이너스 기호는 빈 문자열이 된다', () => {
    expect(toggleSign('-')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// smartBackspace
// ---------------------------------------------------------------------------

describe('smartBackspace', () => {
  it('빈 문자열에서 호출하면 빈 문자열을 반환한다', () => {
    expect(smartBackspace('')).toBe('');
  });

  it('단일 숫자를 삭제한다', () => {
    expect(smartBackspace('7')).toBe('');
  });

  it('여러 자리 숫자에서 마지막 숫자를 삭제한다', () => {
    expect(smartBackspace('123')).toBe('12');
  });

  it('단일 문자 연산자를 삭제한다', () => {
    expect(smartBackspace('3+')).toBe('3');
    expect(smartBackspace('3-')).toBe('3');
    expect(smartBackspace('3(')).toBe('3');
  });

  it('\\div  명령어를 전체 삭제한다', () => {
    expect(smartBackspace('3\\div ')).toBe('3');
  });

  it('\\times  명령어를 전체 삭제한다', () => {
    expect(smartBackspace('3\\times ')).toBe('3');
  });

  it('\\sqrt{} 전체 토큰을 삭제한다', () => {
    expect(smartBackspace('\\sqrt{}')).toBe('');
  });

  it('\\sqrt{4} 전체 토큰을 삭제한다', () => {
    expect(smartBackspace('2+\\sqrt{4}')).toBe('2+');
  });

  it('^{2} 전체 토큰을 삭제한다', () => {
    expect(smartBackspace('x^{2}')).toBe('x');
  });

  it('^{} 전체 토큰을 삭제한다', () => {
    expect(smartBackspace('x^{}')).toBe('x');
  });

  it('\\frac{}{} 전체 토큰을 삭제한다', () => {
    expect(smartBackspace('\\frac{}{}')).toBe('');
  });

  it('\\frac{1}{2} 전체 토큰을 삭제한다', () => {
    expect(smartBackspace('3+\\frac{1}{2}')).toBe('3+');
  });

  it('복합 수식 끝의 마지막 단일 문자만 삭제한다', () => {
    expect(smartBackspace('12+34')).toBe('12+3');
  });

  it('연속 백스페이스로 수식을 모두 지울 수 있다', () => {
    let expr = '\\sqrt{9}';
    expr = smartBackspace(expr); // '\\sqrt{9}' → ''
    expect(expr).toBe('');
  });

  it('부호 토글 후 백스페이스가 올바르게 동작한다', () => {
    const expr = toggleSign('5'); // '-5'
    expect(smartBackspace(expr)).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// 통합 시나리오: 버튼 입력 시퀀스 재현
// ---------------------------------------------------------------------------

describe('버튼 입력 시퀀스 통합 테스트', () => {
  it('3 ÷ 4 를 입력한 뒤 백스페이스로 ÷ 를 지운다', () => {
    let expr = '';
    expr = appendChar(expr, '3');
    expr = appendChar(expr, '\\div ');
    expr = appendChar(expr, '4');
    expect(expr).toBe('3\\div 4');

    expr = smartBackspace(expr); // '4' 삭제
    expect(expr).toBe('3\\div ');

    expr = smartBackspace(expr); // '\\div ' 삭제
    expect(expr).toBe('3');
  });

  it('\\frac{}{} 삽입 후 백스페이스 한 번으로 전체 삭제', () => {
    let expr = '';
    expr = insertTemplate(expr, '\\frac{}{}');
    expect(expr).toBe('\\frac{}{}');
    expr = smartBackspace(expr);
    expect(expr).toBe('');
  });

  it('x² 입력 흐름', () => {
    let expr = '';
    expr = appendChar(expr, 'x');
    expr = appendChar(expr, '^{2}');
    expect(expr).toBe('x^{2}');
    expr = smartBackspace(expr); // '^{2}' 전체 삭제
    expect(expr).toBe('x');
  });

  it('음수 분수 입력 흐름', () => {
    let expr = '';
    expr = insertTemplate(expr, '\\frac{}{}');
    expr = toggleSign(expr); // '-\\frac{}{}'
    expect(expr).toBe('-\\frac{}{}');
    expr = toggleSign(expr); // 부호 제거
    expect(expr).toBe('\\frac{}{}');
  });
});
