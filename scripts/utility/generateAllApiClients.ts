import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { log } from '@charmverse/core/log';

import { generateApiClient, loadAbiFromFile } from '../../lib/generateApiClient';

async function getAllJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function traverse(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        console.log(fullPath);

        // Only include contract artifacts, skip dbg files
        if (!entry.name.includes('.dbg.') && !fullPath.includes('libs') && !fullPath.includes('test')) {
          files.push(fullPath);
        }
      }
    }
  }

  await traverse(dir);
  return [...new Set(files)]; // Remove any duplicates
}

async function generateAllApiClients() {
  // Get all JSON files from artifacts/contracts/protocol
  const artifactsPath = path.resolve('artifacts/contracts/protocol');
  const preSeasonOnePath = path.resolve('artifacts/contracts/SeasonOne');
  const preSeasonTwoPath = path.resolve('artifacts/contracts/PreseasonTwo');
  const starterPackPath = path.resolve('artifacts/contracts/StarterPack');

  const jsonFiles: string[] = [];

  const rootPaths = [artifactsPath]; // , preSeasonOnePath, preSeasonTwoPath, starterPackPath];

  for (const rootPath of rootPaths) {
    const files = await getAllJsonFiles(rootPath);
    jsonFiles.push(...files);
  }

  // Also include any ABIs from the abis directory
  console.log('Generating API clients for the following ABIs:', jsonFiles);

  for (let i = 0; i < jsonFiles.length; i++) {
    const jsonFile = jsonFiles[i];

    log.info(`Generating API client for ${jsonFile} (${i + 1} of ${jsonFiles.length})`);

    const abi = loadAbiFromFile(jsonFile);

    if (abi) {
      const relativePath = path.relative(process.cwd(), jsonFile);
      const classCode = await generateApiClient({
        abi,
        abiPath: relativePath,
        writeClient: false
      });

      const outputPath = path
        .resolve(`${relativePath}`.replace('.json', '.ts'))
        .replace('artifacts/contracts', 'lib/apiClients');

      console.log('Writing API client to', outputPath);

      // Ensure target directory exists
      const targetDir = path.dirname(outputPath);
      if (!fsSync.existsSync(targetDir)) {
        fsSync.mkdirSync(targetDir, { recursive: true });
      }

      await fs.writeFile(outputPath, classCode);
    }
  }
}

generateAllApiClients()
  .then(() => {
    console.log('API clients generated successfully');
  })
  .catch(console.error);
