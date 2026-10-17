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
  params: Record<string, string>,
  deps: ApiDependencies,
): Promise<any> {
  if (!deps.gasUrl || !deps.gasSecret)
    throw new ServiceError(
      503,
      "NOT_CONFIGURED",
      "데이터 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.",
    );
  const url = new URL(deps.gasUrl);
  url.search = new URLSearchParams({
    ...params,
    key: deps.gasSecret,
  }).toString();
  let response: Response;
  try {
    response = await (deps.fetcher || fetch)(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
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
        : code === "BAD_REQUEST"
          ? 400
          : code === "DATA_ERROR"
            ? 502
            : 503;
    const message =
      code === "UNAUTHORIZED"
        ? "나이스번호와 이름을 확인하거나 다시 로그인해 주세요."
        : code === "DATA_ERROR"
          ? "배지 데이터가 올바르지 않습니다. 관리자에게 확인해 주세요."
          : "데이터를 불러오지 못했습니다. 다시 시도해 주세요.";
    throw new ServiceError(status, code || "SERVICE_UNAVAILABLE", message);
  }
  return result.data;
}
