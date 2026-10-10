import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import katex from 'katex';

// Keep LaTeX in data-tex for editing; publish native MathML, with no CDN or
// browser-side typesetting needed. Re-running this script is idempotent.
const root = fileURLToPath(new URL('../src/tools/', import.meta.url));
const decode = source => source.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let count = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, 'index.html');
    let html;
    try { html = await readFile(file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const rendered = html.replace(/(<(span|div) class="optics-(?:inline|equation)" data-tex="([^"]*)">)[\s\S]*?<\/\2>/g,
        (_, opening, tag, source) => {
            const math = katex.renderToString(decode(source), {
                output: 'mathml', displayMode: tag === 'div', throwOnError: true, strict: 'error', trust: false
            }).replace(/^<span class="katex">/, '').replace(/<\/span>$/, '');
            count++;
            return `${opening}${math}</${tag}>`;
        });
    if (rendered !== html) await writeFile(file, rendered);
}
console.log(`Rendered ${count} optics equations from LaTeX to MathML.`);
