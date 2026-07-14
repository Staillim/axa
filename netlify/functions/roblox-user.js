// netlify/functions/roblox-user.js
// Production counterpart of proxy.js. Same input/output, runs server-side
// on Netlify so it has no CORS issues and no need for a long-lived Node server.

const HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
};

async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
        method: options.method || "GET",
        headers: options.headers || {},
        body: options.body,
    });
    const body = await res.json();
    return { status: res.status, body };
}

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

exports.handler = async (event) => {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: HEADERS, body: "" };
    }

    const params = event.queryStringParameters || {};
    const username = params.name || params.username;

    if (!username) {
        return {
            statusCode: 400,
            headers: HEADERS,
            body: JSON.stringify({ error: "Missing name or username query parameter" }),
        };
    }

    try {
        const result = await lookupUser(username);
        if (result.notFound) {
            return {
                statusCode: 404,
                headers: HEADERS,
                body: JSON.stringify({ error: "User not found" }),
            };
        }
        return {
            statusCode: 200,
            headers: HEADERS,
            body: JSON.stringify(result),
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers: HEADERS,
            body: JSON.stringify({ error: e.message }),
        };
    }
};
