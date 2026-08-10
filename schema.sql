-- Mikdaten · Datenbankschema (Cloudflare D1 / SQLite)

DROP TABLE IF EXISTS activity;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS checklist_items;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS columns;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',
  job_title     TEXT,
  phone         TEXT,
  initials      TEXT NOT NULL,
  color         TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  user_agent  TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE properties (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL,
  title          TEXT NOT NULL,
  street         TEXT,
  zip            TEXT,
  city           TEXT,
  country        TEXT DEFAULT 'DE',
  type           TEXT NOT NULL DEFAULT 'wohnung',
  deal           TEXT NOT NULL DEFAULT 'bestand',
  status         TEXT NOT NULL DEFAULT 'aktiv',
  units          INTEGER DEFAULT 1,
  rooms          REAL,
  area_sqm       REAL,
  plot_sqm       REAL,
  year_built     INTEGER,
  energy_class   TEXT,
  purchase_price REAL,
  asking_price   REAL,
  rent_cold      REAL,
  service_charge REAL,
  owner_contact  TEXT,
  image_url      TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'sonstige',
  company     TEXT,
  email       TEXT,
  phone       TEXT,
  street      TEXT,
  zip         TEXT,
  city        TEXT,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL DEFAULT 'verwaltung',
  status       TEXT NOT NULL DEFAULT 'aktiv',
  color        TEXT NOT NULL DEFAULT '#FF4E5B',
  emoji        TEXT DEFAULT '🏠',
  property_id  TEXT REFERENCES properties(id) ON DELETE SET NULL,
  lead_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  budget       REAL,
  volume       REAL,
  start_date   TEXT,
  due_date     TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE columns (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  wip_limit  INTEGER,
  is_done    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_columns_project ON columns(project_id);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  column_id   TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  position    REAL NOT NULL DEFAULT 0,
  priority    TEXT NOT NULL DEFAULT 'normal',
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  labels      TEXT NOT NULL DEFAULT '[]',
  start_date  TEXT,
  due_date    TEXT,
  estimate    REAL,
  amount      REAL,
  done_at     TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_column ON tasks(column_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_comments_task ON comments(task_id);

CREATE TABLE checklist_items (
  id       TEXT PRIMARY KEY,
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_checklist_task ON checklist_items(task_id);

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'termin',
  date        TEXT NOT NULL,
  time        TEXT,
  duration    INTEGER DEFAULT 60,
  location    TEXT,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  contact_id  TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  owner_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_events_date ON events(date);

CREATE TABLE documents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'sonstige',
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  task_id     TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  filename     TEXT,
  content_type TEXT,
  size         INTEGER,
  caption      TEXT,
  is_cover     INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_photos_property ON photos(property_id);

CREATE TABLE activity (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  project_id  TEXT,
  summary     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_activity_created ON activity(created_at);
