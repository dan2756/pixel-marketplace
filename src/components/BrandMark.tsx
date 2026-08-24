import Link from "next/link";

import { PRODUCT_TAGLINE } from "@/lib/constants";

type BrandMarkProps = {
  href?: string;
};

export function BrandMark({ href }: BrandMarkProps) {
  const mark = (
    <span className="brand-mark" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );

  if (href) {
    return (
      <Link className="brand" href={href} aria-label={PRODUCT_TAGLINE}>
        {mark}
      </Link>
    );
  }

  return (
    <div className="brand" aria-label={PRODUCT_TAGLINE}>
      {mark}
    </div>
  );
}
