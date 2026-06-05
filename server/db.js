const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "shift-tracker.db"));

db.pragma('foreign_keys = ON')

db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        activity TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT,
        type TEXT NOT NULL DEFAULT 'actual',
        created_at TEXT NOT NULL,
        class_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classes (
        name TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS breaks (
        id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
    )
`);

// insert defaults settings
db.prepare(`INSERT OR IGNORE INTO settings (name, value) VALUES ('payday', '25')`).run()
db.prepare(`INSERT OR IGNORE INTO settings (name, value) VALUES ('target_hours', '60')`).run()

// insert defaults classes
db.prepare(`INSERT OR IGNORE INTO classes (name) VALUES ('PGE1')`).run()
db.prepare(`INSERT OR IGNORE INTO classes (name) VALUES ('PGE1-PSO')`).run()
db.prepare(`INSERT OR IGNORE INTO classes (name) VALUES ('PGE2')`).run()
db.prepare(`INSERT OR IGNORE INTO classes (name) VALUES ('PGE3')`).run()

module.exports = db;
