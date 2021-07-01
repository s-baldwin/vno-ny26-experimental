import Vue from "https://deno.land/x/vue_js@0.0.5/mod.js";
import * as fs from "https://deno.land/std@0.83.0/fs/mod.ts";
import * as vueCompiler from "https://denopkg.com/crewdevio/vue-deno-compiler/mod.ts";
import renderer from "https://deno.land/x/vue_server_renderer@0.0.4/mod.js";
import * as path from "https://deno.land/std@0.99.0/path/mod.ts";
import { getExport, Mapped } from "./utils.ts";

export interface Component {
  name: string;
  path: string;
  raw: string;
  source: any;
  deps: Set<string>;
  exports: any;
}

// get the unique tags from html
export const getTags = (html: string) => {
  const matches = html.matchAll(
    /(?<=<)[\w\d]+(?=[\s*|>|/>])/gi,
  );

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

// parse components
const parse = (cmps: Mapped<Component>) => {
  const parsed: Mapped<any> = {};

  const seen = new Set<string>();

  const dfs = (cmp: Component) => {
    const components: { [name: string]: any } = {};

    for (const depName of cmp.deps) {
      if (!seen.has(depName)) {
        seen.add(depName);
        dfs(cmps[depName]);
      }
      components[depName] = parsed[depName];
    }

    parsed[cmp.name] = (Vue as any).component(cmp.name, {
      ...cmp.exports,
      name: cmp.name,
      template: cmp.source.descriptor.template.content,
      components,
    });
  };

  for (const cmp of Object.values(cmps)) {
    seen.add(cmp.name);
    dfs(cmp);
  }

  return parsed;
};

// get the vue components
export const getComponents = async () => {
  const cmps: Mapped<Component> = {};

  // grab all components from components folder
  for await (const file of fs.walk("./components", { exts: ["vue"] })) {
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
    };
  }

  // find dependencies for each component
  for (const cmp of Object.values(cmps)) {
    cmp.deps = getDeps(cmp, cmps);
  }

  if (checkCycle(cmps)) {
    throw Error("cycle exists");
  }

  return parse(cmps);
};

const main = async () => {
  const cmps = await getComponents();

  const app = new Vue({
    name: "app",
    template: "<div><h1>My App</h1><Navbar /></div>",
    components: {
      Navbar: cmps["Navbar"],
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
