import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Required for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load server/.env
dotenv.config({
  path: path.join(__dirname, ".env"),
});

console.log("✅ ENV Loaded from:", path.join(__dirname, ".env"));
