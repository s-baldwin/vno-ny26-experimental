import * as fs from 'https://deno.land/std@0.83.0/fs/mod.ts';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import { Mapped } from './utils.ts';

/**
 * Read assets as strings.
 */
export const getAssets = async (match?: RegExp[]) => {
  const assets: Mapped<string> = {};

  // walk through the assets folder
  for await (const file of fs.walk(path.join(Deno.cwd(), 'assets'), {
    includeDirs: false,
    match,
  })) {
    // read and store file contents
    assets[file.path] = await Deno.readTextFile(file.path);
  }

  return assets;
};
