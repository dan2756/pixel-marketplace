import Link from "next/link";

export default function NotFound() {
  return (
    <main className="region-page">
      <article className="standalone-card">
        <span className="eyebrow">404</span>
        <h1>Region not found</h1>
        <p>This region does not exist or has not been confirmed as owned.</p>
        <Link className="primary-button" href="/">
          Explore the canvas
        </Link>
      </article>
    </main>
  );
}
