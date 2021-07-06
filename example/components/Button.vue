<template>
  <div class="button">
    <button>{{ label }}</button>
  </div>
</template>

<script>
export default {
  props: ["label"],
  data() {
    return { other: (this.label || "button") + " - other" };
  },
  css: ["assets/index.css", "assets/button.css"],
};
</script>

<style>
</style>