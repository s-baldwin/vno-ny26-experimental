import Vue from 'https://deno.land/x/vue_js@0.0.5/mod.js';
import * as fs from 'https://deno.land/std@0.99.0/fs/mod.ts';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import renderer from 'https://deno.land/x/vue_server_renderer@0.0.4/mod.js';
import {
  minifyHTML,
  minify,
  Language,
} from 'https://deno.land/x/minifier@v1.1.1/mod.ts';
import { Component, getComponents, getComponent } from './components.ts';
import { Mapped, PathData, getTags } from './utils.ts';
import { getAssets } from './assets.ts';

const __dirname = new URL('.', import.meta.url).pathname;

export interface GenHtmlParams {
  entry: string;
  output: string;
  pathData?: PathData;
  cmps?: Mapped<Component>;
  assets?: Mapped<string>;
  reload?: boolean;
}

/**
 * Generate a vue page component to html.
 */
export const genHtml = async (params: GenHtmlParams) => {
  const { entry, output } = params;

  // destructure these params and load them if needed
  let { cmps, pathData, assets } = params;
  pathData = pathData || { params: {} };
  cmps = cmps || (await getComponents());
  assets = assets || (await getAssets([/\.css$/i]));

  // get the page component info
  const cmp = await getComponent(entry);
  const template = cmp.source.descriptor.template.content as string;
  const styles = cmp.source.descriptor.styles;

  // get component and css dependencies
  const seenCss = new Set(cmp.css); // only need one of each css file
  const components: Mapped<any> = {};
  const tags = getTags(template);
  for (const tag of tags) {
    // only add if is a custom component i.e. in cmps
    if (tag in cmps) {
      components[tag] = cmps[tag].vueCmp;

      // loop through components css
      for (const css of cmps[tag].css) {
        // only added if new
        if (!seenCss.has(css)) {
          seenCss.add(css);
          cmp.css.push(css);
        }
      }
    }
  }

  // get needed css
  let rawCss = '\n';
  // loop through css dependency array, performed in reverse because component level css were added last
  for (const css of [...cmp.css].reverse()) {
    // get the full css path
    const cssFile = path.join(Deno.cwd(), css);

    // throw error if not found from assets folder
    if (!assets[cssFile]) {
      throw Error('invalid css');
    }

    rawCss += `${assets[cssFile]}\n`;
  }

  // call data function from the page component
  const data = await Promise.resolve(
    cmp.exports.getStaticProps
      ? cmp.exports.getStaticProps({
          ...pathData,
          fetch,
        })
      : {}
  );

  // create the vue page component
  const App = new Vue({
    ...cmp.exports,
    name: cmp.name,
    template,
    data() {
      return data;
    },
    components,
  });

  // render the page component to html
  const bodyHtml = await new Promise<string>((resolve, reject) => {
    renderer(App, (err: any, html: string) => {
      if (err) {
        return reject(err);
      }
      return resolve(html);
    });
  });

  // combine all styles
  const rawStyles = minify(
    Language.CSS,
    rawCss + styles.map((style: any) => style.content).join('\n')
  );

  // read the html template
  const htmlTemplate = await Deno.readTextFile(
    path.join(__dirname, 'index.html')
  );

  // insert styles and body
  let html = htmlTemplate
    .replace(/<\/head>/, `<style>${rawStyles}</style>$&`)
    .replace(/<body>/, `$&${bodyHtml}`);

  // add reload
  if (params.reload) {
    const reloadScript = minify(
      Language.JS,
      await Deno.readTextFile(path.join(__dirname, 'reload.js'))
    );
    html = html.replace(/<\/body>/, `<script>${reloadScript}</script>$&`);
  }

  // minify
  const final = minifyHTML(html, { minifyCSS: true, minifyJS: true });

  // write the html file
  await fs.ensureDir(path.parse(output).dir);
  return Deno.writeTextFile(output, final);
};

// DEVELOPMENT ONLY
if (import.meta.main) {
  genHtml({
    entry: './pages/index.vue',
    output: './dist/index.html',
  });
}
