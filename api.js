// if (process.env.NODE_ENV !== 'development') {
  // console.debug = function() {};  // 本番環境ではdebugを無効化
// }

const { Mutex } = require("async-mutex");
const fs = require("fs");
const sqlite = require("sqlite3").verbose();
let db_path = "";
let db = null;
const db_mutex = new Mutex();

async function loadDatabase(name) {
    console.debug("call load database");
    if (db != null) await unloadDatabase();

    const release = await db_mutex.acquire();

    db_path = name;
    db = new sqlite.Database(name);
    await serializeDatabase();

    release();
}

/*
 * After using, db is absolutely null;
*/
async function unloadDatabase() {
    console.debug("call unload database");
    if (db != null) {
        await saveToCache();

        const release = await db_mutex.acquire();

        try {
            await closeDatabase();
            try {
                fs.unlinkSync(db_path);
            } catch (e) {
                console.error("Failed to unlink database file.\ncheck file " + db_path);
            }
            db = null;
        } finally {
            release();
        }
    }
}

function closeDatabase() {
    console.debug("call close database");
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        db.close(err => {
            if (err) {
                console.error("Failed to close database.", err);
                reject(err);
            } else {
                console.debug("Database closing success!");
                resolve();
            }
        });
    });
}

async function saveToCache() {
    console.debug("call save to cache");
    if (db != null) {
        const rows = await getAllUsers();
        if (!rows) return;

        const release = await db_mutex.acquire();
        try {
            const cacheDir = "./caches";
            const cacheFile = `${cacheDir}/${db_path}.json`;

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            let cacheData = {};
            if (fs.existsSync(cacheFile)) {
                try {
                    cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
                } catch (e) {
                    console.error("Failed to parse existing cache file. Resetting cache.");
                    cacheData = {};
                }
            }

            const day = 24 * 60 * 60 * 1000;
            const JST_OFFSET = 9 * 60 * 60 * 1000;
            const today = new Date(Math.floor((Date.now() + JST_OFFSET) / day) * day ).valueOf()

            rows.forEach(({ username, stack, star }) => {
                // 時刻を無視して日付のみを比較
                if (username in cacheData) {
                    const created_at = new Date(cacheData[username].created_at).valueOf();
                    const today = Date.now();

                    const daysDiff = Math.floor((today - created_at) / day);
                    console.log("days diff " + daysDiff);

                    cacheData[username].data[daysDiff] = { stack, star };
                } else {
                    cacheData[username] = {
                        created_at: new Date(today),
                        data: [{ stack, star }]
                    }
                }
            });

            fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), "utf8");
            console.debug("Cache updated successfully.");
        } finally {
            release();
        }
    }
}

async function getAllUsers() {
    console.debug("call get all users");

    const release = await db_mutex.acquire();

    return new Promise((resolve, reject) => {
        db.all("SELECT username, stack, star FROM users", (err, rows) => {
            if (err) {
                console.error("Failed to fetch user data from DB:", err);
                resolve(null);
            } else {
                resolve(rows);
            }
            release();
        });
    });
}

async function serializeDatabase() {
    console.debug("call serialize database");
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    stack INTEGER NOT NULL,
                    star INTEGER NOT NULL
                )
            `, err => {
                if (err) {
                    console.error("Failed to create table.", err);
                    reject(err);
                } else {
                    console.debug("Dabase table created!");
                    resolve();
                }
            })
        })
    })
}

async function changeData(username, stack, star) {
    console.debug("call change database");
    return new Promise(async (resolve, reject) => {
        if (db == null) return reject("Database is not initialize");

        const release = await db_mutex.acquire();
        
        db.get("SELECT * FROM users WHERE username = ?", [username], async (err, row) => {
            // 取得エラー
            if (err) {
                release();
                return reject("Fetch error");
            }

            // ユーザーが見つからない
            if (!row) {
                db.run(
                    "INSERT INTO users (username, stack, star) VALUES (?, ?, ?)",
                    [username, stack, star],
                    (insertErr) => {
                        release();

                        if (insertErr) {
                            console.error("Failed to insert new data.");
                            return reject("Failed to insert new data.");
                        }

                        return resolve(true);
                    }
                )
            }

            // ユーザー発見
            db.run(
                "UPDATE users SET stack = ?, star = ? WHERE username = ?",
                [stack, star, username],
                (updateErr) => {
                    release();

                    if (updateErr) {
                        console.error("Failed to set stack and star in " + username);
                        return reject("Failed to set stack and star in " + username);
                    }

                    return resolve(true);
                }
            )
        })
    });
}

module.exports = { loadDatabase, unloadDatabase, changeData, getAllUsers, saveToCache }