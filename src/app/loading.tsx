export default function Loading() {
  return (
    <main className="success-page">
      <article className="standalone-card" role="status">
        <div className="status-icon">
          <span className="spinner" />
        </div>
        <h1>Loading canvas</h1>
        <p>Preparing the latest ownership snapshot…</p>
      </article>
    </main>
  );
}
