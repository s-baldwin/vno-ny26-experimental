<template>
  <div class="button">
    <button>{{ label }} * {{ other }}</button>
  </div>
</template>

<script>
export default {
  props: ["label"],
  data() {
    return { other: (this.label || "button") + " - other" };
  },
};
</script>

<style>
</style>