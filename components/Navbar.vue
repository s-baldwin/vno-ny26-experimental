<template>
  <div id="navbar">Navbar<Button v-bind:label="label" /></div>
</template>

<script>
export default {
  data() {
    return { label: "navbar label" };
  },
};
</script>

<style>
</style>