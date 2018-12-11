import { Inject } from '../../util/injector';
import { mutation } from '../stateful-service';
import { PersistentStatefulService } from 'services/persistent-stateful-service';
import { Subject } from 'rxjs';
import { WindowsService } from 'services/windows';
import { ServicesManager } from '../../services-manager';
import { IObsInput, TObsFormData } from 'components/obs/inputs/ObsInput';
import {
  ENotificationType,
  INotification,
  INotificationOptions,
  INotificationsServiceApi,
  INotificationsSettings,
} from './notifications-api';
import { $t } from 'services/i18n';

interface INotificationsState {
  settings: INotificationsSettings;
  notifications: INotification[];
}

export class NotificationsService extends PersistentStatefulService<INotificationsState>
  implements INotificationsServiceApi {
  static defaultState: INotificationsState = {
    notifications: [],
    settings: {
      enabled: true,
      playSound: false,
    },
  };

  @Inject() private windowsService: WindowsService;
  servicesManager: ServicesManager = ServicesManager.instance;

  notificationPushed = new Subject<INotification>();
  notificationRead = new Subject<number[]>();

  private nextId = 1;

  init() {
    super.init();
    this.clear();
  }

  push(notifyInfo: INotificationOptions): INotification {
    const notify = {
      id: this.nextId++,
      unread: true,
      date: Date.now(),
      type: ENotificationType.INFO,
      playSound: true,
      lifeTime: 8000,
      showTime: false,
      ...notifyInfo,
    };
    this.doPush(notify);
    this.notificationPushed.next(notify);
    return notify;
  }

  getNotification(id: number): INotification {
    return this.state.notifications.find(notify => notify.id === id);
  }

  applyAction(notificationId: number) {
    const notify = this.getNotification(notificationId);
    if (!notify || !notify.action) return;

    this.servicesManager.executeServiceRequest(notify.action);
  }

  getAll(type?: ENotificationType): INotification[] {
    return this.state.notifications.filter(notify => {
      return !type || notify.type === type;
    });
  }

  getUnread(type?: ENotificationType): INotification[] {
    return this.getAll(type).filter(notify => notify.unread);
  }

  getRead(type?: ENotificationType): INotification[] {
    return this.getAll(type).filter(notify => !notify.unread);
  }

  markAsRead(id: number) {
    const notify = this.getNotification(id);
    if (!notify) return;
    this.doMarkAsRead(id);
    this.notificationRead.next([id]);
  }

  markAllAsRead() {
    const unreadNotifies = this.getUnread();
    if (!unreadNotifies.length) return;
    this.doMarkAllAsRead();
    this.notificationRead.next(unreadNotifies.map(notify => notify.id));
  }

  getSettings(): INotificationsSettings {
    return this.state.settings;
  }

  getSettingsFormData(): TObsFormData {
    const settings = this.state.settings;
    return [
      <IObsInput<boolean>>{
        value: settings.enabled,
        name: 'enabled',
        description: $t('Enable notifications'),
        type: 'OBS_PROPERTY_BOOL',
        visible: true,
        enabled: true,
      },

      <IObsInput<boolean>>{
        value: settings.playSound,
        name: 'playSound',
        description: $t('Enable sound'),
        type: 'OBS_PROPERTY_BOOL',
        visible: true,
        enabled: settings.enabled,
      },
    ];
  }

  setSettings(patch: Partial<INotificationsSettings>) {
    this.doSetSettings(patch);
  }

  restoreDefaultSettings() {
    this.setSettings(NotificationsService.defaultState.settings);
  }

  showNotifications() {
    this.windowsService.showWindow({
      componentName: 'Notifications',
      title: $t('Notifications'),
      size: {
        width: 600,
        height: 600,
      },
    });
  }

  @mutation({ name: 'doSetSettings' })
  private doSetSettings(patch: Partial<INotificationsSettings>) {
    this.state.settings = { ...this.state.settings, ...patch };
  }

  @mutation({ name: 'PUSH' })
  private doPush(notify: INotification) {
    this.state.notifications.unshift(notify);
  }

  @mutation()
  private clear() {
    this.state.notifications.length = 0;
  }

  @mutation({ name: 'MARK_ALL_AS_READ' })
  private doMarkAllAsRead() {
    this.state.notifications.forEach(notify => (notify.unread = false));
  }

  @mutation({ name: 'MARK_AS_READ' })
  private doMarkAsRead(id: number) {
    this.state.notifications.find(notify => notify.id === id).unread = false;
  }
}
