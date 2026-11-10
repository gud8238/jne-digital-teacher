import type { ApiResult } from "../src/domain/badges";
export type ApiDependencies = {
  gasUrl?: string;
  gasSecret?: string;
  fetcher?: typeof fetch;
};
export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function callGas(
  params: Record<string, unknown>,
  deps: ApiDependencies,
): Promise<any> {
  if (!deps.gasUrl || !deps.gasSecret)
    throw new ServiceError(
      503,
      "NOT_CONFIGURED",
      "데이터 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.",
    );
  const url = new URL(deps.gasUrl);
  let response: Response;
  try {
    response = await (deps.fetcher || fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...params, key: deps.gasSecret }),
      redirect: "follow",
      signal: AbortSignal.timeout(
        String(params.action).startsWith("submission-") ||
          params.action === "admin-provision"
          ? 45000
          : 20000,
      ),
    });
  } catch {
    throw new ServiceError(
      503,
      "SERVICE_UNAVAILABLE",
      "연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  let result: ApiResult<any>;
  try {
    result = await response.json();
  } catch {
    throw new ServiceError(
      502,
      "INVALID_RESPONSE",
      "데이터 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!response.ok || typeof result?.ok !== "boolean")
    throw new ServiceError(
      502,
      "INVALID_RESPONSE",
      "데이터 연결 상태를 확인해 주세요.",
    );
  if (!result.ok) {
    const code = result.error?.code;
    const status =
      code === "UNAUTHORIZED"
        ? 401
        : [
              "BAD_REQUEST",
              "INVALID_FILE",
              "UPLOAD_OFFSET",
              "UPLOAD_INCOMPLETE",
            ].includes(code || "")
          ? 400
          : code === "FORBIDDEN"
            ? 403
            : code === "NOT_FOUND"
              ? 404
              : code === "CONFLICT" || code === "BUSY"
                ? 409
                : code === "PAYLOAD_TOO_LARGE"
                  ? 413
                  : code === "DATA_ERROR"
                    ? 502
                    : 503;
    const message =
      code === "UNAUTHORIZED"
        ? "이름과 연수원 아이디를 확인하거나 다시 로그인해 주세요."
        : code === "FORBIDDEN"
          ? "이 배지에는 서류를 제출할 수 없습니다."
          : code === "NOT_FOUND"
            ? "양식이 아직 준비되지 않았습니다."
            : code === "CONFLICT" || code === "BUSY"
              ? "처리 중입니다. 잠시 후 다시 시도해 주세요."
              : code === "UPLOAD_INCOMPLETE"
                ? "파일 업로드가 완료되지 않았습니다. 다시 제출해 주세요."
                : code === "UPLOAD_OFFSET"
                  ? "업로드 진행 상태를 확인한 뒤 다시 시도해 주세요."
                  : code === "INVALID_FILE"
                    ? "파일 형식을 확인해 주세요."
                    : code === "PAYLOAD_TOO_LARGE"
                      ? "파일은 20MB 이하로 제출해 주세요."
                      : code === "DATA_ERROR"
                        ? "배지 데이터가 올바르지 않습니다. 관리자에게 확인해 주세요."
                        : "데이터를 불러오지 못했습니다. 다시 시도해 주세요.";
    throw new ServiceError(status, code || "SERVICE_UNAVAILABLE", message);
  }
  return result.data;
}
