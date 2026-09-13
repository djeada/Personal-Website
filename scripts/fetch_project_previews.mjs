// Refresh locally hosted previews from the projects' own README images.
// Run from the repository root: node scripts/fetch_project_previews.mjs
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const page = await readFile('src/core/projects.html', 'utf8');
const repos = [...new Set([...page.matchAll(/data-repo="djeada\/([^"]+)/g)].map(match => match[1]))];
repos.push('blender-mcp-server', 'paraview-mcp-server');
const directory = 'src/resources/project-previews';
await mkdir(directory, { recursive: true });
const manifest = {};
for (const repo of repos) {
    for (const branch of ['main', 'master']) {
        const base = `https://raw.githubusercontent.com/djeada/${repo}/${branch}/`;
        const response = await fetch(`${base}README.md`);
        if (!response.ok) continue;
        const readme = await response.text();
        const images = [...readme.matchAll(/!\[[^\]]*\]\(([^\s)]+)|<img[^>]+src=["']([^"']+)/g)]
            .map(match => match[1] || match[2])
            .filter(url => !/badge|shields|logo|icon|star-history|contrib\.rocks/i.test(url));
        if (repo === 'Standard-of-Iron') images.unshift('docs/screenshots/campaign-war-table.webp');
        for (const candidate of images) {
            const url = candidate.startsWith('http') ? candidate : new URL(candidate, base).href;
            const image = await fetch(url);
            const type = image.headers.get('content-type')?.split(';')[0];
            const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[type];
            if (!image.ok || !extension) continue;
            const bytes = Buffer.from(await image.arrayBuffer());
            if (bytes.length > 4_000_000) continue;
            const original = `${directory}/${repo.toLowerCase()}.download`;
            const filename = `${repo.toLowerCase()}.webp`;
            await writeFile(original, bytes);
            execFileSync('convert', [`${original}[0]`, '-resize', '1280x900>', '-quality', '82', `${directory}/${filename}`]);
            await unlink(original);
            manifest[repo] = { file: filename, source: url };
            break;
        }
        break;
    }
}
await writeFile(`${directory}/sources.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Saved ${Object.keys(manifest).length} project previews.`);
