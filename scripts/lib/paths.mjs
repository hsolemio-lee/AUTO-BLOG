import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "..", "..");
export const STATE_DIR = path.join(ROOT_DIR, ".autoblog", "state");
export const OUT_DIR = path.join(ROOT_DIR, ".autoblog", "out");
export const CONTENT_DIR = path.join(ROOT_DIR, "content", "posts");

export const TOPIC_FILE = path.join(STATE_DIR, "topic.json");
export const RESEARCH_FILE = path.join(STATE_DIR, "research.json");
export const ARTICLE_FILE = path.join(OUT_DIR, "article.json");
export const QUALITY_FILE = path.join(OUT_DIR, "quality-report.json");

export const SOURCES_CONFIG_FILE = path.join(ROOT_DIR, "config", "sources.yaml");
export const ARTICLE_SCHEMA_FILE = path.join(ROOT_DIR, "schemas", "article.schema.json");
