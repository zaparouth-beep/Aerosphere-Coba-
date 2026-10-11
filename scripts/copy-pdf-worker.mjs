// Copies the pdf.js worker to public/ so it is served as a static file (webpack must not minify it).
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
fs.mkdirSync("public", { recursive: true });
fs.copyFileSync(src, "public/pdf.worker.min.mjs");
