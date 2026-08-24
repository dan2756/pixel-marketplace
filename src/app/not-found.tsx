export default function NotFound() {
  return (
    <main className="region-page">
      <article className="standalone-card">
        <span className="eyebrow">404</span>
        <h1>Region not found</h1>
        <p>This region does not exist or has not been confirmed as owned.</p>
        <a className="primary-button" href="/">
          Explore the canvas
        </a>
      </article>
    </main>
  );
}
