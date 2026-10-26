import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const modelRoot = path.join(projectRoot, 'assets', 'models');
const tempRoot = path.join(os.tmpdir(), 'traffic-expert-assets');

const SOURCES = {
  roads: {
    url: 'https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1791628607/kenney_city-kit-roads.zip',
    page: 'https://kenney.nl/assets/city-kit-roads',
    version: '2.2'
  },
  cars: {
    url: 'https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip',
    page: 'https://kenney.nl/assets/car-kit',
    version: '3.1'
  },
  characters: {
    url: 'https://drive.usercontent.google.com/download?id=1rrj82IYNaSWj5ySxR6fW9oojyHFiW7_r&export=download&confirm=t',
    page: 'https://quaternius.com/packs/ultimatedanimatedcharacter.html',
    version: 'November 2019'
  }
};

const selections = [
  ['roads', 'Models/GLB format/road-crossroad-path.glb', 'roads/road-crossroad-path.glb'],
  ['roads', 'Models/GLB format/road-straight.glb', 'roads/road-straight.glb'],
  ['roads', 'Models/GLB format/traffic-light.glb', 'props/traffic-light.glb'],
  ['roads', 'Models/GLB format/light-curved.glb', 'props/light-curved.glb'],
  ['roads', 'Models/GLB format/construction-cone.glb', 'props/construction-cone.glb'],
  ['cars', 'Models/GLB format/sedan.glb', 'cars/sedan.glb'],
  ['cars', 'Models/GLB format/suv.glb', 'cars/suv.glb']
];

const textureSelections = [
  ['roads', 'Models/GLB format/Textures/colormap.png', 'roads/Textures/colormap.png'],
  ['roads', 'Models/GLB format/Textures/colormap.png', 'props/Textures/colormap.png'],
  ['cars', 'Models/GLB format/Textures/colormap.png', 'cars/Textures/colormap.png']
];

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.subarray(0, 15).toString().toLowerCase().includes('<!doctype html')) {
    throw new Error(`Received an HTML error page instead of an asset from ${url}`);
  }
  await writeFile(destination, data);
}

function extractZipEntry(zip, wantedName) {
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('Invalid ZIP: end record not found');

  const entryCount = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory');
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString();

    if (name === wantedName) {
      if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP entry: ${name}`);
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(start, start + compressedSize);
      const output = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
      if (!output) throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
      if (output.length !== uncompressedSize) throw new Error(`Truncated ZIP entry: ${name}`);
      return output;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`Required file is missing from archive: ${wantedName}`);
}

async function prepareCharacter() {
  const explicit = process.env.QUATERNIUS_CHARACTER;
  const supplied = path.resolve(projectRoot, '..', 'glTF', 'Casual_Male.gltf');
  const input = path.join(tempRoot, 'Casual_Male.gltf');
  const source = explicit ? path.resolve(explicit) : existsSync(supplied) ? supplied : null;
  if (source) {
    await writeFile(input, await readFile(source));
    console.log(`Using Quaternius source: ${source}`);
  } else {
    console.log('Downloading Quaternius Casual_Male.gltf…');
    await download(SOURCES.characters.url, input);
  }

  const output = path.join(modelRoot, 'characters', 'casual.glb');
  await mkdir(path.dirname(output), { recursive: true });
  const args = [
    '--yes', '@gltf-transform/cli@4.2.1', 'optimize', input, output,
    '--compress', 'draco', '--texture-compress', 'false'
  ];
  let result;
  if (process.platform === 'win32') {
    if (args.some((value) => value.includes('"'))) throw new Error('Asset paths cannot contain double quotes.');
    const command = ['npx', ...args].map((value) => /\s/.test(value) ? `"${value}"` : value).join(' ');
    result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
      stdio: 'inherit',
      windowsVerbatimArguments: true
    });
  } else {
    result = spawnSync('npx', args, { stdio: 'inherit' });
  }
  if (result.status !== 0 || !existsSync(output)) {
    throw new Error('Character conversion failed. Node/npm and network access to @gltf-transform/cli@4.2.1 are required.');
  }
}

async function writeCredits() {
  const content = `# Asset Credits

Accessed: 2026-10-26

| Asset | Author | License | Source | Files used |
|---|---|---|---|---|
| City Kit (Roads) ${SOURCES.roads.version} | Kenney | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | ${SOURCES.roads.page} | Road crossroad/path, straight, traffic light, curved lamp, construction cone |
| Car Kit ${SOURCES.cars.version} | Kenney | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | ${SOURCES.cars.page} | Sedan, SUV |
| Ultimate Animated Character Pack (${SOURCES.characters.version}) | Quaternius | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | ${SOURCES.characters.page} | Casual_Male, including Idle and Walk animations |

The Kenney licenses were confirmed both on the official pack downloads and in each archive's \`License.txt\`. The Quaternius license was confirmed on the official pack page and in the supplied pack's \`License.txt\`.
`;
  await writeFile(path.join(projectRoot, 'CREDITS.md'), content);
}

async function main() {
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });
  await mkdir(modelRoot, { recursive: true });

  const archives = {};
  for (const key of ['roads', 'cars']) {
    const destination = path.join(tempRoot, `${key}.zip`);
    console.log(`Downloading ${key} pack…`);
    await download(SOURCES[key].url, destination);
    archives[key] = await readFile(destination);
  }

  for (const [archive, source, destination] of [...selections, ...textureSelections]) {
    const output = path.join(modelRoot, destination);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, extractZipEntry(archives[archive], source));
    console.log(`Extracted ${destination}`);
  }

  await prepareCharacter();
  await writeCredits();
  const files = await Promise.all([...selections, ...textureSelections].map(async ([, , destination]) => (
    await readFile(path.join(modelRoot, destination))
  ).length));
  files.push((await readFile(path.join(modelRoot, 'characters', 'casual.glb'))).length);
  const total = files.reduce((sum, size) => sum + size, 0);
  if (total > 5 * 1024 * 1024) throw new Error(`Model budget exceeded: ${(total / 1048576).toFixed(2)} MB`);
  console.log(`Done: ${(total / 1048576).toFixed(2)} MB across ${files.length} model files.`);
}

main().catch((error) => {
  console.error(`Asset preparation failed: ${error.message}`);
  process.exitCode = 1;
});
