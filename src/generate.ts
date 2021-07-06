import * as fs from 'https://deno.land/std@0.99.0/fs/mod.ts';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import { genHtml } from './html.ts';
import { getComponent, getComponents } from './components.ts';
import { getAssets } from './assets.ts';

/**
 * Statically generate project.
 */
export const generate = async () => {
  const start = Date.now();

  await fs.emptyDir(path.join(Deno.cwd(), 'dist'));

  const cmps = await getComponents();
  const assets = await getAssets([/\.css$/i]);

  const pagesDir = path.join(Deno.cwd(), 'pages');
  for await (const file of fs.walk(pagesDir, {
    exts: ['vue'],
  })) {
    const parsed = path.parse(file.path);
    const name = parsed.name;
    const relPath = parsed.dir.replace(pagesDir, '');

    // dynamic pages
    if (name.match(/\[.*\]/)) {
      const cmp = await getComponent(file.path);

      if (!cmp.exports.getStaticPaths) {
        throw Error('missing getStaticPaths');
      }

      // get the paths
      const pathsData = await Promise.resolve(cmp.exports.getStaticPaths());

      // create a page for each path
      for (const pathData of pathsData) {
        // get the page id
        const id = pathData.params[name.slice(1, name.length - 1)];

        // create an output location using the id
        const output = path.join(Deno.cwd(), 'dist', relPath, id, 'index.html');

        await genHtml({
          entry: file.path,
          output,
          pathData,
          cmps,
          assets,
          reload: true,
        });
      }
    } else {
      // named pages

      // create an output location based on the name
      const output = path.join(
        Deno.cwd(),
        'dist',
        relPath,
        name == 'index' ? 'index.html' : `${name}/index.html`
      );

      await genHtml({
        entry: file.path,
        output: output,
        cmps,
        assets,
        reload: true,
      });
    }
  }

  console.log(`build took ${Date.now() - start}ms`);
};

if (import.meta.main) {
  generate();
}
