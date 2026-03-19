#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const open = require("open");
const https = require("https");

require('dotenv').config();

const API_KEY = process.env.GIPHY_API_KEY;
const HISTORY_FILE = path.join(__dirname, "gif-history.json");
const HISTORY_LIMIT = 20;
const SEARCH_LIMIT = 50;
const RATING = "g";

if (!API_KEY) {
    console.error("Missing GIPHY_API_KEY environment variable.");
    console.error("Example:");
    console.error('export GIPHY_API_KEY="your_api_key_here"');
    process.exit(1);
}

function loadHistory() {
    if (!fs.existsSync(HISTORY_FILE)) {
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    } catch (error) {
        return {};
    }
}

function saveHistory(history) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
}

function shuffle(array) {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
}

function getGifUrl(gif) {
    return (
        gif?.images?.original?.url ||
        gif?.images?.downsized_large?.url ||
        gif?.images?.fixed_height?.url ||
        gif?.url ||
        null
    );
}

async function searchGifs(keyword) {
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.searchParams.set("api_key", API_KEY);
    url.searchParams.set("q", keyword);
    url.searchParams.set("limit", String(SEARCH_LIMIT));
    url.searchParams.set("rating", RATING);
    url.searchParams.set("lang", "en");

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`GIPHY API error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    return payload.data || [];
}

function pickGif(keyword, gifs, history) {
    const usedIds = history[keyword] || [];
    const unusedGifs = gifs.filter((gif) => !usedIds.includes(gif.id));

    let pool = unusedGifs;

    if (pool.length === 0) {
        history[keyword] = [];
        pool = gifs;
    }

    if (pool.length === 0) {
        return null;
    }

    const [selectedGif] = shuffle(pool);
    history[keyword] = [...(history[keyword] || []), selectedGif.id].slice(-HISTORY_LIMIT);

    return selectedGif;
}

async function main() {
    const keyword = process.argv.slice(2).join(" ").trim();

    if (!keyword) {
        console.error('Usage: node random-gif.js "pizza"');
        process.exit(1);
    }

    const history = loadHistory();
    const gifs = await searchGifs(keyword);

    if (!gifs.length) {
        console.error(`No GIF found for keyword: "${keyword}"`);
        process.exit(1);
    }

    const selectedGif = pickGif(keyword, gifs, history);
    const gifUrl = getGifUrl(selectedGif);

    if (!selectedGif || !gifUrl) {
        console.error("Could not select a valid GIF.");
        process.exit(1);
    }

    // Save the updated history before downloading and opening the GIF
    saveHistory(history);

    // Opens the GIF in the default browser
    await open(gifUrl);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
