<template>
  <div id="app">
    <h1>{{ title }}</h1>
    <p>store stuff</p>
    <a href="/">Back</a>
  </div>
</template>

<script>
export default {
  async getStaticProps(ctx) {
    await ctx.fetch("https://deno.land/");
    return {
      title: ctx.params.id || "Default",
    };
  },
  getStaticPaths() {
    return [
      { params: { id: "apple" } },
      { params: { id: "google" } },
      { params: { id: "facebook" } },
    ];
  },
};
</script>

<style>
html {
  background-color: #203a42;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #79d0b2;
  margin-top: 60px;
}
</style>