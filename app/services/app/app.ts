import uuid from 'uuid/v4';
import { StatefulService, mutation } from 'services/stateful-service';
import { OnboardingService } from 'services/onboarding';
import { HotkeysService } from 'services/hotkeys';
import { UserService } from 'services/user';
import { ShortcutsService } from 'services/shortcuts';
import { getResource, Inject } from 'util/injector';
import electron from 'electron';
import { TransitionsService } from 'services/transitions';
import { SourcesService } from 'services/sources';
import { ScenesService } from 'services/scenes';
import { VideoService } from 'services/video';
import { StreamInfoService } from 'services/stream-info';
import { track } from 'services/usage-statistics';
import { IpcServerService } from 'services/ipc-server';
import { TcpServerService } from 'services/tcp-server';
import { StreamlabelsService } from 'services/streamlabels';
import { PerformanceMonitorService } from 'services/performance-monitor';
import { SceneCollectionsService } from 'services/scene-collections';
import { FileManagerService } from 'services/file-manager';
import { PatchNotesService } from 'services/patch-notes';
import { ProtocolLinksService } from 'services/protocol-links';
import { WindowsService } from 'services/windows';
import * as obs from '../../../obs-api';
import { FacemasksService } from 'services/facemasks';
import { OutageNotificationsService } from 'services/outage-notifications';
import { CrashReporterService } from 'services/crash-reporter';
import { PlatformAppsService } from 'services/platform-apps';
import { AnnouncementsService } from 'services/announcements';
import { ObsUserPluginsService } from 'services/obs-user-plugins';
import { IncrementalRolloutService } from 'services/incremental-rollout';
import electronLog from 'electron-log';

const crashHandler = window['require']('crash-handler');

interface IAppState {
  loading: boolean;
  argv: string[];
}

/**
 * Performs operations that happen once at startup and shutdown. This service
 * mainly calls into other services to do the heavy lifting.
 */
export class AppService extends StatefulService<IAppState> {
  @Inject() onboardingService: OnboardingService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() hotkeysService: HotkeysService;
  @Inject() userService: UserService;
  @Inject() shortcutsService: ShortcutsService;
  @Inject() streamInfoService: StreamInfoService;
  @Inject() patchNotesService: PatchNotesService;
  @Inject() windowsService: WindowsService;
  @Inject() facemasksService: FacemasksService;
  @Inject() outageNotificationsService: OutageNotificationsService;
  @Inject() platformAppsService: PlatformAppsService;

  static initialState: IAppState = {
    loading: true,
    argv: electron.remote.process.argv
  };

  private autosaveInterval: number;

  @Inject() transitionsService: TransitionsService;
  @Inject() sourcesService: SourcesService;
  @Inject() scenesService: ScenesService;
  @Inject() videoService: VideoService;
  @Inject() streamlabelsService: StreamlabelsService;
  @Inject() private ipcServerService: IpcServerService;
  @Inject() private tcpServerService: TcpServerService;
  @Inject() private performanceMonitorService: PerformanceMonitorService;
  @Inject() private fileManagerService: FileManagerService;
  @Inject() private protocolLinksService: ProtocolLinksService;
  @Inject() private crashReporterService: CrashReporterService;
  @Inject() private announcementsService: AnnouncementsService;
  @Inject() private obsUserPluginsService: ObsUserPluginsService;
  @Inject() private incrementalRolloutService: IncrementalRolloutService;
  private loadingPromises: Dictionary<Promise<any>> = {};


  private pid = require('process').pid;

  @track('app_start')
  async load() {
    this.START_LOADING();
    electronLog.info('Main renderer register process');
    crashHandler.registerProcess(this.pid, false);

    electronLog.info('Initialize obs user plugins service');
    await this.obsUserPluginsService.initialize();

    // Initialize OBS
    electronLog.info('Initialize OBS API');
    obs.NodeObs.OBS_API_initAPI('en-US', electron.remote.process.env.SLOBS_IPC_USERDATA);

    // We want to start this as early as possible so that any
    // exceptions raised while loading the configuration are
    // associated with the user in sentry.
    electronLog.info('Initialize user service');
    await this.userService.initialize();

    // Second, we want to start the crash reporter service.  We do this
    // after the user service because we want crashes to be associated
    // with a particular user if possible.
    electronLog.info('Start crash-reporter');
    this.crashReporterService.beginStartup();

    // Initialize any apps before loading the scene collection.  This allows
    // the apps to already be in place when their sources are created.
    electronLog.info('Initialize platform app service');
    await this.platformAppsService.initialize();

    electronLog.info('Initialize scene collection service');
    await this.sceneCollectionsService.initialize()

    electronLog.info('Start onboarding if required');
    const onboarded = this.onboardingService.startOnboardingIfRequired();

    electron.ipcRenderer.on('shutdown', () => {
      electron.ipcRenderer.send('acknowledgeShutdown');
      this.shutdownHandler();
    });

    electronLog.info('Start facemask service');
    this.facemasksService;

    electronLog.info('Start incremental rollout service');
    this.incrementalRolloutService;
    electronLog.info('Start shotcut service');
    this.shortcutsService;
    electronLog.info('Start streamlabel service');
    this.streamlabelsService;

    // Pre-fetch stream info
    electronLog.info('Start stream info service');
    this.streamInfoService;

    electronLog.info('Start performance monitor service');
    this.performanceMonitorService.start();

    electronLog.info('Listen ipc server service');
    this.ipcServerService.listen();
    electronLog.info('Listen tcp server service');
    this.tcpServerService.listen();

    electronLog.info('Show patch notes if required');
    this.patchNotesService.showPatchNotesIfRequired(onboarded);
    electronLog.info('Update banner');
    this.announcementsService.updateBanner();
    electronLog.info('Start outage notification service');
    this.outageNotificationsService;

    electronLog.info('End startup crash-reporter service');
    this.crashReporterService.endStartup();

    this.FINISH_LOADING();
    this.protocolLinksService.start(this.state.argv);
  }

  @track('app_close')
  private shutdownHandler() {
    this.START_LOADING();
    obs.NodeObs.StopCrashHandler();

    this.crashReporterService.beginShutdown();

    this.ipcServerService.stopListening();
    this.tcpServerService.stopListening();

    window.setTimeout(async () => {
      await this.sceneCollectionsService.deinitialize();
      this.performanceMonitorService.stop();
      this.transitionsService.shutdown();
      this.windowsService.closeAllOneOffs();
      await this.fileManagerService.flushAll();
      obs.NodeObs.OBS_service_removeCallback();
      obs.NodeObs.OBS_API_destroyOBS_API();
      obs.IPC.disconnect();
      this.crashReporterService.endShutdown();
      electron.ipcRenderer.send('shutdownComplete');
    }, 300);
  }

  /**
   * Show loading, block the nav-buttons and disable autosaving
   * If called several times - unlock the screen only after the last function/promise has been finished
   * Should be called for any scene-collections loading operations
   * @see RunInLoadingMode decorator
   */
  async runInLoadingMode(fn: () => Promise<any> | void) {

    if (!this.state.loading) {
      this.START_LOADING();
      this.windowsService.closeChildWindow();
      this.windowsService.closeAllOneOffs();
      this.sceneCollectionsService.disableAutoSave();
    }

    let error: Error = null;
    let result: any = null;

    try {
      result = fn();
    } catch (e) {
      error = null;
    }

    let returningValue = result;
    if (result instanceof Promise) {
      const promiseId = uuid();
      this.loadingPromises[promiseId] = result;
      try {
        returningValue = await result;
      } catch (e) {
        error = e;
      }
      delete this.loadingPromises[promiseId];
    }

    if (Object.keys(this.loadingPromises).length > 0) {
      // some loading operations are still in progress
      // don't stop the loading mode
      if (error) throw error;
      return returningValue;
    }

    this.tcpServerService.startRequestsHandling();
    this.sceneCollectionsService.enableAutoSave();
    this.FINISH_LOADING();
    if (error) throw error;
    return returningValue;
  }


  @mutation()
  private START_LOADING() {
    this.state.loading = true;
  }

  @mutation()
  private FINISH_LOADING() {
    this.state.loading = false;
  }

  @mutation()
  private SET_ARGV(argv: string[]) {
    this.state.argv = argv;
  }
}
