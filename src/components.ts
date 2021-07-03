import Vue from 'https://deno.land/x/vue_js@0.0.5/mod.js';
import * as fs from 'https://deno.land/std@0.83.0/fs/mod.ts';
import * as vueCompiler from 'https://denopkg.com/crewdevio/vue-deno-compiler/mod.ts';
import renderer from 'https://deno.land/x/vue_server_renderer@0.0.4/mod.js';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import { getExport, Mapped, VueExport } from './utils.ts';

export interface Component {
  name: string;
  path: string;
  raw: string;
  source: any;
  deps: Set<string>;
  exports: VueExport['default'];
  css: string[];
  vueCmp: any;
}

// get the unique tags from html
export const getTags = (html: string) => {
  const matches = html.matchAll(/(?<=<)[\w\d]+(?=[\s*|>|/>])/gi);

  return new Set([...matches].map((match) => match[0]));
};

// find dependencies for each component
export const getDeps = (cmp: Component, cmps: Mapped<Component>) => {
  const deps = new Set<string>();

  const tags = getTags(cmp.source.descriptor.template.content as string);

  for (const tag of tags) {
    if (tag in cmps) {
      deps.add(tag);
    }
  }

  return deps;
};

// detect if there are any circular dependencies within components
const checkCycle = (cmps: Mapped<Component>) => {
  const seen = new Set<string>();
  const completed = new Set<string>();

  // perform dfs
  const dfs = (cmp: Component) => {
    for (const depName of cmp.deps) {
      if (seen.has(depName) && !completed.has(depName)) {
        return true;
      }

      if (!seen.has(depName)) {
        seen.add(depName);
        if (dfs(cmps[depName])) return true;
      }
    }

    completed.add(cmp.name);
    return false;
  };

  // check all components
  for (const cmp of Object.values(cmps)) {
    if (!seen.has(cmp.name) && dfs(cmp)) {
      seen.add(cmp.name);
      return true;
    }
  }
  return false;
};

const getCss = (cmps: Mapped<Component>) => {
  const seen = new Set<string>();

  const dfs = (cmp: Component) => {
    const seenCss = new Set(cmp.css);

    for (const depName of cmp.deps) {
      if (!seen.has(depName)) {
        seen.add(depName);
        dfs(cmps[depName]);
      }

      for (const css of cmps[depName].css) {
        if (!seenCss.has(css)) {
          seenCss.add(css);
          cmp.css.push(css);
        }
      }
    }
  };

  for (const cmp of Object.values(cmps)) {
    if (!seen.has(cmp.name)) {
      seen.add(cmp.name);
      dfs(cmp);
    }
  }
};

// assets
export const getAssets = async () => {
  const assets: Mapped<string> = {};

  for await (const file of fs.walk(path.join(Deno.cwd(), './assets'), {
    includeDirs: false,
  })) {
    assets[file.path] = await Deno.readTextFile(file.path);
  }

  return assets;
};

// parse components
const parse = (cmps: Mapped<Component>, assets: Mapped<string>) => {
  const seen = new Set<string>();

  const dfs = (cmp: Component) => {
    const components: { [name: string]: any } = {};

    for (const depName of cmp.deps) {
      if (!seen.has(depName)) {
        seen.add(depName);
        dfs(cmps[depName]);
      }
      components[depName] = cmps[depName].vueCmp;
    }

    const vueCmp = (Vue as any).component(cmp.name, {
      ...cmp.exports,
      name: cmp.name,
      template: cmp.source.descriptor.template.content,
      components,
    });

    cmp.vueCmp = vueCmp;
  };

  for (const cmp of Object.values(cmps)) {
    seen.add(cmp.name);
    dfs(cmp);
  }
};

// get the vue components
export const getComponents = async (assets?: Mapped<string>) => {
  if (!assets) {
    assets = await getAssets();
  }

  const cmps: Mapped<Component> = {};

  // grab all components from components folder
  for await (const file of fs.walk(path.join(Deno.cwd(), './components'), {
    exts: ['vue'],
  })) {
    // const name = file.name.match(/.*(?=.vue)/)!.toString();
    const name = path.parse(file.path).name;
    const raw = await Deno.readTextFile(file.path);
    const source = vueCompiler.parse(raw);
    const exports = await getExport(source.descriptor.script.content as string);

    cmps[name] = {
      name,
      path: file.path,
      raw,
      source,
      deps: new Set(),
      exports: exports.default,
      css: exports.default.css || [],
      vueCmp: null,
    };
  }

  // find dependencies for each component
  for (const cmp of Object.values(cmps)) {
    cmp.deps = getDeps(cmp, cmps);
  }

  if (checkCycle(cmps)) {
    throw Error('cycle exists');
  }

  getCss(cmps);
  parse(cmps, assets);

  return cmps;
};

const main = async () => {
  const cmps = await getComponents();

  const app = new Vue({
    name: 'app',
    template: '<div><h1>My App</h1><Navbar /></div>',
    components: {
      Navbar: cmps['Navbar'].vueCmp,
    },
  });

  return new Promise((resolve, reject) =>
    renderer(app, (err: any, html: string) => {
      if (err) {
        return reject(err);
      }
      return resolve(html);
    })
  );
};

if (import.meta.main) {
  console.log(await main());
}
