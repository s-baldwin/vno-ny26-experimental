import Vue from 'https://deno.land/x/vue_js@0.0.5/mod.js';
import * as fs from 'https://deno.land/std@0.99.0/fs/mod.ts';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import * as vueCompiler from 'https://denopkg.com/crewdevio/vue-deno-compiler/mod.ts';
import renderer from 'https://deno.land/x/vue_server_renderer@0.0.4/mod.js';
import {
  minifyHTML,
  minify,
  Language,
} from 'https://deno.land/x/minifier@v1.1.1/mod.ts';
import { Component, getAssets, getComponents, getTags } from './components.ts';
import { getExport, Mapped, Path } from './utils.ts';
const __dirname = new URL('.', import.meta.url).pathname;

export const getComponent = async (filePath: string) => {
  const name = path.parse(filePath).name;

  // read file
  const raw = await Deno.readTextFile(filePath);

  // parse
  const source = vueCompiler.parse(raw);

  // get script export
  const obj = await getExport(source.descriptor.script.content as string);

  return {
    name,
    raw,
    source,
    exports: obj.default,
  };
};

interface ToHtmlParams {
  filePath: string;
  outFile: string;
  pathData?: Path;
  cmps?: Mapped<Component>;
}

export const toHtml = async (params: ToHtmlParams) => {
  const { filePath, outFile } = params;

  // defaults
  let { cmps, pathData } = params;
  pathData = pathData || { params: {} };
  cmps = cmps || (await getComponents());

  const name = path.parse(filePath).name;

  // read file
  const text = await Deno.readTextFile(filePath);

  // parse
  const source = vueCompiler.parse(text);

  // get script export
  const obj = await getExport(source.descriptor.script.content as string);

  // clean template
  const template = (source.descriptor.template.content as string).replace(
    /<!--([\s\S]*?)-->/gm,
    ''
  );

  // get dependencies
  const css = obj.default.css || [];
  const seenCss = new Set(css);
  const components: Mapped<any> = {};
  const tags = getTags(template);
  for (const tag of tags) {
    if (tag in cmps && !(tag in components)) {
      components[tag] = cmps[tag].vueCmp;
      for (const cssPath of cmps[tag].css) {
        if (!seenCss.has(cssPath)) {
          seenCss.add(cssPath);
          css.push(cssPath);
        }
      }
    }
  }
  const assets = await getAssets();
  let cmpCss = '\n';
  for (const cssPath of [...css].reverse()) {
    const fullCssPath = path.join(Deno.cwd(), cssPath);
    if (!assets[fullCssPath]) {
      throw Error('invalid css');
    }
    cmpCss += `${assets[fullCssPath]}\n`;
  }

  // get data
  const data = await Promise.resolve(
    obj.default.getStaticProps
      ? obj.default.getStaticProps({
          ...pathData,
          fetch,
        })
      : {}
  );

  // page component
  const App = new Vue({
    name,
    template,
    data() {
      return data;
    },
    components,
  });

  // html
  const bodyHtml = await new Promise<string>((resolve, reject) => {
    renderer(App, (err: any, html: string) => {
      if (err) {
        return reject(err);
      }
      return resolve(html);
    });
  });

  // styles
  let styles =
    cmpCss +
    source.descriptor.styles.map((style: any) => style.content).join('\n');
  styles = minify(Language.CSS, styles);

  // write to file
  await fs.ensureDir(path.parse(outFile).dir);

  // setup template
  const htmlTemplate = await Deno.readTextFile(
    path.join(__dirname, 'template.html')
  );

  // add styles and content
  const html = htmlTemplate
    .replace(/<\/head>/, `<style>${styles}</style>$&`)
    .replace(/<body>/, `$&${bodyHtml}`);

  const final = minifyHTML(html, { minifyCSS: true, minifyJS: true });

  // write the html file
  return Deno.writeTextFile(outFile, final);
};

if (import.meta.main) {
  toHtml({
    outFile: './dist/index.html',
    filePath: './pages/index.vue',
  });
}
