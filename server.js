const express = require("express");
const fs = require("fs");
const { loadDatabase, saveToCache, changeData, getAllUsers } = require("./api");

const hour = 60 * 60 * 1000;
const day = 24 * hour;

const app = express();
app.use(express.json())

let current_season = "default.db";

loadDatabase(current_season);

setSaveCacheTimeout();

app.get("/api/static_data", (req, res) => {
    console.log("request static data");
    try {
        const cachefile = `./caches/${current_season}.json`;

        if (!fs.existsSync(cachefile)) {
            return res.send("{}").status(200);
        }

        const secondUtilEndOfDay = Math.floor((calculateEndOfDay() - Date.now()) / 1000);

        const data = fs.readFileSync(cachefile);
        return res.set("Cache-Control", `public max-age=${secondUtilEndOfDay}, immutable`).send(data).status(200);
    } catch (e) {
        res.send("{}").status(200);
    }
})

app.get("/api/current_data", (req, res) => {
    getAllUsers().then(data => {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate").send(data).status(200);
    }).catch(err => {
        res.send(err).status(500);
    });
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
    return res.status(200).send();
})

function calculateEndOfDay() {
    return ((Math.floor(Date.now() / day) + 1) * day) - 1;
}

function setSaveCacheTimeout() {
    setTimeout(() => {
        console.log("saving...");
        saveToCache();
        setSaveCacheTimeout();
    }, calculateEndOfDay() - Date.now())
}

app.listen(5678, () => {
    console.log("server listening 5678")
});