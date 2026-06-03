PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  framework TEXT,
  status TEXT NOT NULL DEFAULT 'local',
  source_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

CREATE TABLE IF NOT EXISTS controls (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  control_text TEXT,
  section_ref TEXT,
  framework TEXT,
  source_page INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_controls_document_id ON controls(document_id);

CREATE TABLE IF NOT EXISTS risk_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT,
  url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  risk_source_id TEXT,
  title TEXT,
  body TEXT,
  effective_date TEXT,
  region_hint TEXT,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (risk_source_id) REFERENCES risk_sources(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_issues_risk_source_id ON issues(risk_source_id);

CREATE TABLE IF NOT EXISTS issue_classifications (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  classification_json TEXT NOT NULL,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issue_classifications_issue_id ON issue_classifications(issue_id);

CREATE TABLE IF NOT EXISTS candidate_risks (
  id TEXT PRIMARY KEY,
  issue_ids_json TEXT NOT NULL DEFAULT '[]',
  title TEXT,
  description TEXT,
  domain TEXT,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS risk_library (
  id TEXT PRIMARY KEY,
  industry TEXT,
  risk_domain TEXT,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  source_ref TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS risk_discovery_results (
  id TEXT PRIMARY KEY,
  candidate_risk_id TEXT,
  library_risk_id TEXT,
  match_status TEXT,
  rationale TEXT,
  bm25_score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (candidate_risk_id) REFERENCES candidate_risks(id) ON DELETE CASCADE,
  FOREIGN KEY (library_risk_id) REFERENCES risk_library(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_discovery_candidate ON risk_discovery_results(candidate_risk_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
