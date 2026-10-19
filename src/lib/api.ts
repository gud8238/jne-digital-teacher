export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/" + path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ApiError(
      503,
      "SERVICE_UNAVAILABLE",
      "연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      502,
      "INVALID_RESPONSE",
      "데이터 응답을 확인할 수 없습니다. 다시 시도해 주세요.",
    );
  }
  if (!response.ok || result?.ok !== true)
    throw new ApiError(
      response.status,
      result?.error?.code || "INVALID_RESPONSE",
      result?.error?.message ||
        "데이터를 불러오지 못했습니다. 다시 시도해 주세요.",
    );
  return result.data as T;
}
