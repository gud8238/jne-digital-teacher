export default function AsyncState({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div className="async-state" role="status">
        <span className="spinner" />
        배지 정보를 불러오고 있습니다.
      </div>
    );
  if (error)
    return (
      <div className="async-state error-state" role="alert">
        <p>{error}</p>
        {onRetry ? (
          <button className="button button-outline" onClick={onRetry}>
            다시 시도
          </button>
        ) : null}
      </div>
    );
  return null;
}
