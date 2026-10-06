CREATE TABLE workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL
);
INSERT INTO workspace (id, revision, body) VALUES (1, 0, '{"settings":{"title":"道東冬日自駕","start":"","end":"","members":"","budget":0,"rate":0.22,"notes":""},"days":[],"bookings":[],"places":[],"shopping":[],"packing":[],"tasks":[],"expenses":[],"contacts":[]}');
