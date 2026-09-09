import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "dist");
const storePath = process.env.SCORE_STORE_PATH || resolve(__dirname, "data", "high-scores.json");
const port = Number(process.env.PORT || 3000);
const timeZone = process.env.SCORE_TIME_ZONE || "America/Los_Angeles";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date());
}

function blankScores() {
  return {
    todayDate: todayKey(),
    todayHighest: 0,
    todayName: "",
    allTimeHighest: 0,
    allTimeName: "",
  };
}

function normalizeScores(scores) {
  const todayDate = todayKey();
  const todayHighest = Number.isFinite(scores.todayHighest) ? scores.todayHighest : 0;
  const allTimeHighest = Number.isFinite(scores.allTimeHighest) ? scores.allTimeHighest : 0;
  const current = {
    todayDate: typeof scores.todayDate === "string" ? scores.todayDate : todayDate,
    todayHighest,
    todayName: typeof scores.todayName === "string" && scores.todayName ? scores.todayName : todayHighest > 0 ? "Unknown scorer" : "",
    allTimeHighest,
    allTimeName:
      typeof scores.allTimeName === "string" && scores.allTimeName
        ? scores.allTimeName
        : allTimeHighest > 0
          ? "Unknown scorer"
          : "",
  };

  if (current.todayDate !== todayDate) {
    current.todayDate = todayDate;
    current.todayHighest = 0;
    current.todayName = "";
  }

  return current;
}

function cleanName(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.slice(0, 24) || "Unknown scorer";
}

function isClaimableName(name) {
  return !name || name === "Unknown scorer";
}

function readScores() {
  try {
    if (!existsSync(storePath)) {
      return blankScores();
    }

    return normalizeScores(JSON.parse(readFileSync(storePath, "utf8")));
  } catch {
    return blankScores();
  }
}

function writeScores(scores) {
  mkdirSync(resolve(storePath, ".."), { recursive: true });
  writeFileSync(storePath, `${JSON.stringify(scores, null, 2)}\n`);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[".json"],
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        request.destroy();
        rejectBody(new Error("Request body too large."));
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

async function handleApi(request, response) {
  if (request.url === "/api/high-scores" && request.method === "GET") {
    sendJson(response, 200, readScores());
    return true;
  }

  if (request.url === "/api/high-scores" && request.method === "POST") {
    try {
      const body = JSON.parse(await readRequestBody(request));
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0) {
        sendJson(response, 400, { error: "Score must be a non-negative number." });
        return true;
      }

      const scores = readScores();
      const name = cleanName(body.name);
      const todayRecord = score > scores.todayHighest || (score === scores.todayHighest && isClaimableName(scores.todayName));
      const allTimeRecord =
        score > scores.allTimeHighest || (score === scores.allTimeHighest && isClaimableName(scores.allTimeName));

      if (todayRecord) {
        scores.todayHighest = score;
        scores.todayName = name;
      }

      if (allTimeRecord) {
        scores.allTimeHighest = score;
        scores.allTimeName = name;
      }

      writeScores(scores);
      sendJson(response, 200, { ...scores, todayRecord, allTimeRecord });
    } catch {
      sendJson(response, 400, { error: "Invalid score payload." });
    }
    return true;
  }

  return false;
}

function serveStatic(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(distDir, requestedPath));

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const pathToServe = existsSync(filePath) ? filePath : join(distDir, "index.html");
  const extension = extname(pathToServe);
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": contentTypes[extension] || "application/octet-stream",
  });
  createReadStream(pathToServe).pipe(response);
}

createServer(async (request, response) => {
  if (await handleApi(request, response)) {
    return;
  }

  serveStatic(request, response);
}).listen(port, "0.0.0.0", () => {
  console.log(`Isaac Demo listening on ${port}`);
});
