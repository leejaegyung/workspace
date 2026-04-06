/**
 * 전역 fetch 래퍼
 * - credentials: 'include' 자동 포함 (쿠키 전송)
 * - 401 응답 시 등록된 핸들러 호출 (로그인 페이지 리다이렉트)
 */

type Handler = () => void;
let _handler401: Handler | null = null;

/** AuthContext에서 401 핸들러를 등록 */
export function register401Handler(fn: Handler) {
  _handler401 = fn;
}

/** 전역 fetch — credentials 자동, 401 자동 처리 */
export async function apiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const opts: RequestInit = {
    credentials: 'include',
    ...init,
  };

  const res = await fetch(input as string, opts);

  if (res.status === 401) {
    const url = typeof input === 'string' ? input : input.toString();
    // 로그인/회원가입 자체 API는 무시 (무한 루프 방지)
    const isAuthRoute = url.includes('/api/auth/login')
      || url.includes('/api/auth/register')
      || url.includes('/api/auth/me');

    if (!isAuthRoute) {
      _handler401?.();
    }
  }

  return res;
}

/** 편의 함수: JSON 응답 파싱 포함 */
export async function apiJson<T = any>(
  input: string | URL,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await apiFetch(input, init);
  const data = await res.json().catch(() => ({} as T));
  return { ok: res.ok, status: res.status, data };
}
