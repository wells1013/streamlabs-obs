<template>
<modal-layout
  :title="$t('Source Interaction')"
  :content-styles="{ padding: 0 }"
  :showControls="false">
  <div
    slot="content"
    class="source-interaction-display"
    ref="display"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mousemove="handleMouseMove"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp">
    <display :source-id="sourceId" @outputResize="onOutputResize"/>
  </div>
</modal-layout>
</template>

<script lang="ts" src="./BrowserSourceInteraction.vue.ts"></script>

<style lang="less" scoped>
.source-interaction-display {
  height: 100%;
}
</style>
