import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

// Function to extract metadata using Cheerio
const extractMetadata = (html, url) => {
  const $ = cheerio.load(html);
  const metadata = {
    title:
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      "",
    description:
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "",
    image:
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      "",
    url,
  };
  return metadata;
};

router.get("/", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    // 1️⃣ Try normal scraping first
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      },
      timeout: 7000,
    });

    const metadata = extractMetadata(response.data, url);

    // If basic scraping gives us something, return it
    if (metadata.title || metadata.description || metadata.image)
      return res.json(metadata);

    // 2️⃣ If scraping fails to get proper metadata, use Microlink fallback
    const microRes = await axios.get(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`
    );
    if (microRes.data && microRes.data.data) {
      const data = microRes.data.data;
      return res.json({
        title: data.title || "",
        description: data.description || "",
        image: data.image?.url || "",
        url: data.url || url,
      });
    }

    // 3️⃣ If all fails
    return res.json({ title: url, description: "", image: "", url });
  } catch (err) {
    console.error("Metadata fetch error:", err.message);

    // If scraping fails → fallback to Microlink
    try {
      const microRes = await axios.get(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}`
      );
      if (microRes.data && microRes.data.data) {
        const data = microRes.data.data;
        return res.json({
          title: data.title || "",
          description: data.description || "",
          image: data.image?.url || "",
          url: data.url || url,
        });
      }
    } catch (e) {
      console.error("Microlink fallback failed:", e.message);
    }

    return res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

export default router;
