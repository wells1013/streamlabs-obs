import { Module, apiMethod, EApiPermissions, IApiContext } from './module';
import { Inject } from 'util/injector';
import electron from 'electron';
import { VideoService, Display } from 'services/video';

export class DisplayModule extends Module {

  @Inject() videoService: VideoService;

  moduleName = 'Display';
  permissions = [EApiPermissions.DisplayEmbed];

  @apiMethod()
  createDisplay(ctx: IApiContext) {
    const win = electron.remote.BrowserWindow.fromId(ctx.browserWindowId);
    const handle = win.getNativeWindowHandle();
    const displayId = this.videoService.getRandomDisplayId();

    const display = new Display(displayId, {
      windowHandle: handle
    });

    display.move(0, 0);
    display.resize(400, 400);
  }

}
