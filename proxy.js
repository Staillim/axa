// proxy.js — CORS proxy for Roblox public APIs (zero-dep Node)
// Mirrors the rubux project pattern. Local dev: http://localhost:3000
const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

// ============== helpers ==============
function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith("https") ? https : http;
        const u = new URL(url);
        const reqOpts = {
            method: options.method || "GET",
            hostname: u.hostname,
            path: u.pathname + u.search,
            port: u.port || (lib === https ? 443 : 80),
            headers: options.headers || {},
        };
        const req = lib.request(reqOpts, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    reject(new Error(`Bad JSON (${res.statusCode}): ${data.slice(0, 200)}`));
                }
            });
        });
        req.on("error", reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
}

// ============== user lookup pipeline ==============
async function lookupUser(username) {
    // Step 1 — username → id
    const idRes = await fetchJson("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    if (!idRes.body?.data || idRes.body.data.length === 0) {
        return { notFound: true };
    }
    const userId = idRes.body.data[0].id;
    const requestedName = idRes.body.data[0].name;

    // Step 2 — id → profile details
    const detailRes = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
    const u = detailRes.body;

    // Step 3 — id → headshot avatar
    let avatarUrl = null;
    try {
        const avatarRes = await fetchJson(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        avatarUrl = avatarRes.body?.data?.[0]?.imageUrl || null;
    } catch (_) {
        // avatar is optional; ignore failures
    }

    return {
        id: u.id,
        name: u.name,
        displayName: u.displayName,
        hasVerifiedBadge: !!u.hasVerifiedBadge,
        avatarUrl,
    };
}

// ============== server ==============
const server = http.createServer(async (req, res) => {
    cors(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    // /api/user/:username  OR  /api/user?name=...
    if (req.url.startsWith("/api/user")) {
        let username = null;
        const pathMatch = req.url.match(/^\/api\/user\/([^/?#]+)/);
        if (pathMatch) {
            username = decodeURIComponent(pathMatch[1]);
        } else {
            const url = new URL(req.url, `http://localhost:${PORT}`);
            username = url.searchParams.get("name") || url.searchParams.get("username");
        }
        if (!username) return send(res, 400, { error: "Missing username" });
        try {
            const result = await lookupUser(username);
            if (result.notFound) return send(res, 404, { error: "User not found" });
            return send(res, 200, result);
        } catch (e) {
            return send(res, 500, { error: e.message });
        }
    }

    // health check
    if (req.url === "/" || req.url === "/health") {
        return send(res, 200, { ok: true, service: "roblox-proxy" });
    }

    send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`✓ Roblox proxy running on http://localhost:${PORT}`);
    console.log(`  Try:  http://localhost:${PORT}/api/user/Roblox`);
});
