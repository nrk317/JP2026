CREATE TABLE IF NOT EXISTS trip_images (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 name TEXT NOT NULL,
 data TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS trip_images_owner ON trip_images(owner,deleted_at);
