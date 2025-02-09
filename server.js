const express = require("express");
const fs = require("fs");
const cors = require("cors")
const { loadDatabase, saveToCache, changeData, getAllUsers } = require("./api");

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const isDebug = (process.env.development === 'true');

const app = express();
app.use(express.json())
app.use(cors({
    origin: function (origin, callback) {
        if (origin === "http://localhost:5173" || origin === "https://stackmanager.rikka-space.com" || isDebug) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["POST", "GET"],
    allowedHeaders: ['Content-Type']
}))

let current_season = "default.db";

loadDatabase(current_season);

let changed = false;
setInterval(() => {
    if (changed) {
        changed = false;
        saveToCache();
    }
}, 1 * 60 * 1000);
saveToCache();

app.get("/api/current_data", (req, res) => {
    res.send(readDataWithCache(`./caches/${current_season}.json`)).status(200);
})

app.post("/api/update_data", (req, res) => {
    const {username, stack, star} = req.body;
    if (username == undefined || stack == undefined || star == undefined) {
        return res.status(400).json({ error: "username, stack and star needed" });
    }
    if (typeof username !== "string" || typeof stack !== "number" || typeof star !== "number") {
        return res.status(400).json({ error: "username: string, stack: number, star: number" });
    } 

    changeData(username, stack, star);
    changed = true;
    return res.status(200).send();
})

function calculateEndOfDay() {
    return ((Math.floor(Date.now() / day) + 1) * day) - 1;
}

let cachedData = null;
let cachedTime = null;
function readDataWithCache(path) {
    fs.stat(path, (err, stats) => {
        if (err) {
            return null;
        }

        if (!cachedTime || stats.mtime > cachedTime) {
            fs.readFile(path, 'utf8', (err, data) => {
                if (err) {
                    console.error("Error reading file:", err);
                    return;
                }

                cachedData = data;
                cachedTime = stats.mtime;
            });
        }

        return cachedData;
    });
}


app.listen(5678, () => {
    console.log("server listening 5678")
});