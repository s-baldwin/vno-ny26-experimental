<template>
  <div id="app">
    <h1>{{ title }}</h1>
    <Navbar />
    <a href="/">Back</a>
  </div>
</template>

<script>
export default {
  getStaticProps(id) {
    return {
      title: id || "Default",
    };
  },
  getStaticPaths() {
    return ["apple", "google", "facebook"];
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