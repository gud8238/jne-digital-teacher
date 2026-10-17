import { validateBadges, validateMe } from "../src/domain/badges";
import { callGas, ServiceError, type ApiDependencies } from "./gas-client";
import { readSession, sessionCookie } from "./session";
export type { ApiDependencies } from "./gas-client";
export async function handleApi(
  request: Request,
  deps: ApiDependencies = {
    gasUrl: process.env.GAS_WEB_APP_URL,
    gasSecret: process.env.GAS_SHARED_SECRET,
  },
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  const send = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  try {
    const url = new URL(request.url),
      action = url.pathname.split("/").filter(Boolean).pop() || "";
    const methods: Record<string, string> = {
      badges: "GET",
      login: "POST",
      me: "GET",
      logout: "POST",
    };
    if (!methods[action])
      throw new ServiceError(
        404,
        "NOT_FOUND",
        "요청한 화면을 찾을 수 없습니다.",
      );
    if (request.method !== methods[action]) {
      headers.set("allow", methods[action]);
      throw new ServiceError(
        405,
        "METHOD_NOT_ALLOWED",
        "요청 방식을 확인해 주세요.",
      );
    }
    if (
      request.method === "POST" &&
      request.headers.get("origin") &&
      request.headers.get("origin") !== url.origin
    )
      throw new ServiceError(
        403,
        "INVALID_ORIGIN",
        "현재 웹앱에서 다시 시도해 주세요.",
      );
    let data: unknown;
    if (action === "badges") {
      try {
        data = validateBadges(await callGas({ action }, deps));
      } catch (e) {
        if (e instanceof ServiceError) throw e;
        throw new ServiceError(
          502,
          "DATA_ERROR",
          "배지 데이터를 확인해 주세요.",
        );
      }
    } else if (action === "login") {
      let input: any;
      try {
        input = await request.json();
      } catch {
        throw new ServiceError(
          400,
          "BAD_REQUEST",
          "나이스번호와 이름을 입력해 주세요.",
        );
      }
      if (
        typeof input?.neisNumber !== "string" ||
        typeof input?.name !== "string" ||
        !input.neisNumber.trim() ||
        !input.name.trim() ||
        input.neisNumber.length > 128 ||
        input.name.length > 80
      )
        throw new ServiceError(
          400,
          "BAD_REQUEST",
          "나이스번호와 이름을 입력해 주세요.",
        );
      const result = await callGas(
        {
          action,
          neisNumber: input.neisNumber.trim(),
          name: input.name.trim(),
        },
        deps,
      );
      if (
        !/^[a-f0-9]{64}$/.test(result?.token || "") ||
        typeof result.teacher?.id !== "string" ||
        typeof result.teacher?.name !== "string"
      )
        throw new ServiceError(
          502,
          "DATA_ERROR",
          "로그인 응답을 확인할 수 없습니다.",
        );
      headers.set("set-cookie", sessionCookie(request, result.token));
      data = {
        teacher: {
          id: result.teacher.id,
          name: result.teacher.name,
          school: result.teacher.school || null,
        },
      };
    } else {
      const token = readSession(request);
      if (!token && action !== "logout") {
        throw new ServiceError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
      }
      if (action === "logout") {
        try {
          if (token) await callGas({ action, token }, deps);
        } catch (e) {
          if (!(e instanceof ServiceError && e.status === 401)) throw e;
        }
        headers.set("set-cookie", sessionCookie(request, "", true));
        data = { loggedOut: true };
      } else {
        const result = await callGas({ action, token: token! }, deps);
        try {
          data = validateMe(result);
        } catch {
          throw new ServiceError(
            502,
            "DATA_ERROR",
            "배지 데이터를 확인해 주세요.",
          );
        }
      }
    }
    return send({ ok: true, data });
  } catch (e) {
    const error =
      e instanceof ServiceError
        ? e
        : new ServiceError(
            503,
            "SERVICE_UNAVAILABLE",
            "데이터 연결을 확인해 주세요.",
          );
    // A stale GET can finish after a new login; it must not erase the new cookie.
    if (error.status === 401 && request.method === "POST")
      headers.set("set-cookie", sessionCookie(request, "", true));
    return send(
      { ok: false, error: { code: error.code, message: error.message } },
      error.status,
    );
  }
}
