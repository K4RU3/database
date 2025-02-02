CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    stack INTEGER NOT NULL,
    star INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, passhash, stack, star, created_at) VALUES
    ('user1', 'pass1', 1000, 0, DATETIME('now', '-1 days')),
    ('user2', 'pass2', 800, 0, DATETIME('now')),
    ('user3', 'pass3', 1200, 0, DATETIME('now'));