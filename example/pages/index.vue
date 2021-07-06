<template>
  <div id="app">
    <h1>{{ title }}</h1>
    <p>Hello there</p>
    <Navbar />
    <img
      src="https://svgshare.com/i/SNz.svg"
      alt="image"
      border="0"
      width="450"
      height="450"
    />
    <a href="/store/default">Stuff</a>
  </div>
</template>

<script>
export default {
  getStaticProps() {
    return {
      title: "My App 3",
    };
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