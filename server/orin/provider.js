
"use strict";

const gemini = require("./providers/gemini");

function getProvider() {
  const provider = (
    process.env.AI_PROVIDER || "gemini"
  ).trim().toLowerCase();

  if (provider !== "gemini") {
    throw new Error(
      `Unsupported AI provider: ${provider}`
    );
  }

  return gemini;
}

module.exports = { getProvider };
