import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import ModalLayout from 'components/ModalLayout.vue';
import Display from 'components/shared/Display.vue';
import { Inject } from 'util/injector';
import { WindowsService } from 'services/windows';
import { ISourcesServiceApi } from 'services/sources';
import Util from 'services/utils';
import { $t } from 'services/i18n';
import windowMixin from '../mixins/window';

@Component({
  components: {
    ModalLayout,
    Display
  },
  mixins: [windowMixin]
})
export default class BrowserSourceInteraction extends Vue {
  @Inject() windowsService: WindowsService;
  @Inject() sourcesService: ISourcesServiceApi;

  $refs: {
    display: HTMLDivElement;
  };

  get sourceId() {
    const windowId = Util.getCurrentUrlParams().windowId;
    return this.windowsService.getWindowOptions(windowId).sourceId;
  }

  get source() {
    return this.sourcesService.getSource(this.sourceId);
  }

  currentRegion: IRectangle = { x: 0, y: 0, width: 1, height: 1 };

  onOutputResize(region: IRectangle) {
    console.log('output resize', region);
    this.currentRegion = region;
  }

  handleMouseDown(e: MouseEvent) {
    this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), false);
  }

  handleMouseUp(e: MouseEvent) {
    this.source.mouseClick(e.button, this.eventLocationInSourceSpace(e), true);
  }

  handleMouseMove(e: MouseEvent) {
    this.source.mouseMove(this.eventLocationInSourceSpace(e));
  }

  handleWheel(e: WheelEvent) {
    console.log(e);
    this.source.mouseWheel(
      this.eventLocationInSourceSpace(e),
      {
        x: e.deltaX,
        y: e.deltaY
      }
    );
  }

  handleKeyDown(e: KeyboardEvent) {
    console.log(e);
    this.source.keyInput(e.key, false);
  }

  handleKeyUp(e: KeyboardEvent) {
    this.source.keyInput(e.key, true);
  }

  eventLocationInSourceSpace(e: MouseEvent): IVec2 {
    return {
      x: (e.offsetX - this.currentRegion.x) / this.currentRegion.width * this.source.width,
      y: (e.offsetY - this.currentRegion.y) / this.currentRegion.height * this.source.height
    };
  }

}
