export default function PageBanner({
  title,
  subtitle,
  description,
  className = "",
}: {
  title: string;
  subtitle?: string;
  description?: string;
  className?: string;
}) {
  return (
    <section className={`page-banner ${className}`}>
      <div className="banner-art left" aria-hidden="true" />
      <div className="banner-art right" aria-hidden="true" />
      <h1>{title}</h1>
      {subtitle ? <strong>{subtitle}</strong> : null}
      {description ? <p>{description}</p> : null}
    </section>
  );
}
