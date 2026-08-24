CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  CREATE TYPE claim_status AS ENUM (
    'reserved',
    'payment_pending',
    'owned',
    'expired',
    'cancelled',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY,
  status claim_status NOT NULL DEFAULT 'reserved',
  x integer NOT NULL,
  y integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  x_range int4range GENERATED ALWAYS AS (int4range(x, x + width, '[)')) STORED,
  y_range int4range GENERATED ALWAYS AS (int4range(y, y + height, '[)')) STORED,
  color varchar(7) NOT NULL,
  destination_url text NOT NULL,
  unit_price_cents integer NOT NULL DEFAULT 25,
  total_cents integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'usd',
  idempotency_key uuid NOT NULL,
  checkout_session_id text,
  checkout_url text,
  customer_email text,
  owner_subject text,
  expires_at timestamptz NOT NULL,
  purchased_at timestamptz,
  stripe_event_created_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT claims_x_bounds CHECK (x >= 0 AND x < 1280),
  CONSTRAINT claims_y_bounds CHECK (y >= 0 AND y < 720),
  CONSTRAINT claims_dimensions CHECK (
    width > 0 AND height > 0 AND x + width <= 1280 AND y + height <= 720
  ),
  CONSTRAINT claims_selection_size CHECK (
    width >= 4 AND height >= 4
    AND width * height >= 100
    AND width * height <= 10000
  ),
  CONSTRAINT claims_unit_price CHECK (
    unit_price_cents IN (20, 25)
  ),
  CONSTRAINT claims_price_snapshot CHECK (
    unit_price_cents > 0 AND total_cents = width * height * unit_price_cents
  )
);

DO $$
BEGIN
  ALTER TABLE claims ADD CONSTRAINT claims_selection_size CHECK (
    width >= 4 AND height >= 4
    AND width * height >= 100
    AND width * height <= 10000
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE claims ADD CONSTRAINT claims_unit_price CHECK (
    unit_price_cents IN (20, 25)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS claims_idempotency_key_uq ON claims (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS claims_checkout_session_id_uq
  ON claims (checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS claims_status_expires_idx ON claims (status, expires_at);
CREATE INDEX IF NOT EXISTS claims_owned_purchased_idx
  ON claims (purchased_at) WHERE status = 'owned';

DO $$
BEGIN
  ALTER TABLE claims ADD CONSTRAINT claims_no_active_overlap
    EXCLUDE USING gist (
      x_range WITH &&,
      y_range WITH &&
    )
    WHERE (status IN ('reserved', 'payment_pending', 'owned'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_created_at timestamptz NOT NULL,
  claim_id uuid,
  payload_digest varchar(64) NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE IF NOT EXISTS board_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

INSERT INTO board_state (singleton, revision)
VALUES (true, 0)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS rate_limits (
  identifier_hash varchar(64) NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (identifier_hash, window_start),
  CONSTRAINT rate_limits_positive_count CHECK (request_count > 0)
);
