"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const REPOSITORY = "vinitbirla29-ops/mindvaulttheory";
const BRANCH = "main";
const KNOWLEDGE_PATH = "server/orin/knowledge.md";

const KNOWLEDGE_URL =
  `https://raw.githubusercontent.com/${REPOSITORY}/${BRANCH}/${KNOWLEDGE_PATH}`;

const ROOT = path.resolve(__dirname, "../..");
const CACHE_MS = 60_000;

let cached = null;
let lastLoaded = 0;

async function getKnowledge() {
  if (cached && Date.now() - lastLoaded < CACHE_MS) {
    return cached;
  }

  try {
    const response = await fetch(KNOWLEDGE_URL, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(4500),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("GitHub knowledge fetch failed");
    }

    const body = await response.text();

    if (!body.trim() || body.length > 100_000) {
      throw new Error("Knowledge file missing or too large");
    }

    cached = body;
    lastLoaded = Date.now();

    return cached;
  } catch (_) {
    try {
      const body = await fs.readFile(
        path.join(ROOT, KNOWLEDGE_PATH),
        "utf8"
      );

      if (!body.trim()) {
        throw new Error("Empty knowledge file");
      }

      cached = body;
      lastLoaded = Date.now();

      return cached;
    } catch (_) {
      if (cached) return cached;

      throw new Error("Knowledge unavailable");
    }
  }
}

async function getSystemPrompt() {
  const file = await fs.readFile(
    path.join(ROOT, "server/orin/prompt.js"),
    "utf8"
  );

  const match = file.match(
    /export\s+const\s+ORIN_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`\s*;/
  );

  if (!match) {
    throw new Error("ORIN system prompt not found");
  }

  return match[1];
}

module.exports = {
  getKnowledge,
  getSystemPrompt
};
    
