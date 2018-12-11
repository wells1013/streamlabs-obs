import { PersistentStatefulService } from 'services/persistent-stateful-service';
import { mutation } from './stateful-service';
import Vue from 'vue';

export enum EDismissable {
  SceneCollectionsHelpTip = 'scene_collections_help_tip',
}

interface IDismissablesServiceState {
  [key: string]: boolean;
}

/**
 * A dismissable is anything that can be dismissed and should
 * never show up again, like a help tip.
 */
export class DismissablesService extends PersistentStatefulService<IDismissablesServiceState> {
  shouldShow(key: EDismissable): boolean {
    return !this.state[key];
  }

  dismiss(key: EDismissable) {
    this.doDismiss(key);
  }

  dismissAll() {
    Object.keys(EDismissable).forEach(key => this.dismiss(EDismissable[key]));
  }

  @mutation()
  private doDismiss(key: EDismissable) {
    Vue.set(this.state, key, true);
  }
}
