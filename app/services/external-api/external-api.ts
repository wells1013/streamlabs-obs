import { IObsListOption, TObsFormData } from '../../components/obs/inputs/ObsInput';
import { Observable } from 'rxjs';
import {
  Source,
  SourcesService,
  TSourceType
} from '../sources';
import { Inject } from '../../util/injector';
import { Service } from 'services/service';
import { IJsonRpcRequest, IJsonRpcResponse } from '../jsonrpc';

export class ExternalApi extends Service {

  handleRequest(request: IJsonRpcRequest): IJsonRpcResponse<any> {

  }

  getResource(resourceId) {

  }



}


export interface ISourceAddOptions {
  channel?: number;
  isTemporary?: boolean;
}

class SLSourcesService {
  @Inject() protected sourcesService: SourcesService;

  createSource(
    name: string,
    type: TSourceType,
    settings?: Dictionary<any>,
    options?: ISourceAddOptions,
  ): SLSource {
    const source = this.sourcesService.createSource(name, type, settings, options);
    return this.getSource(source.sourceId);
  }

  getSource(sourceId: string): SLSource {
    const source = this.sourcesService.getSource(sourceId);
    return source ? new SLSource(source) : null;
  }

  getSources(): SLSource[] {
    return this.sourcesService.getSources().map(source => this.getSource(source.sourceId));
  }

  removeSource(id: string): void {
    this.sourcesService.removeSource(id);
  }

  getAvailableSourcesTypesList(): IObsListOption<TSourceType>[] {
    return this.sourcesService.getAvailableSourcesTypesList();
  }

  getSourcesByName(name: string): SLSource[] {
    return this.sourcesService
      .getSourcesByName(name)
      .map(source => this.getSource(source.sourceId));
  }

  /**
   * creates a source from a file
   * source type depends on the file extension
   */
  addFile(path: string): SLSource {
    return this.getSource(this.sourcesService.addFile(path).sourceId);
  }

  showSourceProperties(sourceId: string): void {
    return this.sourcesService.showSourceProperties(sourceId);
  }

  showShowcase(): void {
    return this.sourcesService.showShowcase();
  }

  showAddSource(sourceType: TSourceType): void {
    return this.sourcesService.showAddSource(sourceType);
  }

  get sourceAdded(): Observable<ISourceModel> {
    return this.sourcesService.sourceAdded;
  }

  get sourceUpdated(): Observable<ISourceModel> {
    return this.sourcesService.sourceUpdated;
  }

  get sourceRemoved(): Observable<ISourceModel> {
    return this.sourcesService.sourceUpdated;
  }
}

interface ISourceModel {
  sourceId: string;
  name: string;
  type: TSourceType;
  audio: boolean;
  video: boolean;
  async: boolean;
  muted: boolean;
  width: number;
  height: number;
  doNotDuplicate: boolean;
  channel?: number;
}

class SLSource implements ISourceModel {
  sourceId: string;
  name: string;
  type: TSourceType;
  audio: boolean;
  video: boolean;
  async: boolean;
  muted: boolean;
  width: number;
  height: number;
  doNotDuplicate: boolean;
  channel?: number;

  constructor(private source: Source) {}

  updateSettings(settings: Dictionary<any>): void {
    this.source.updateSettings(settings);
  }

  getSettings(): Dictionary<any> {
    return this.source.getSettings();
  }

  getPropertiesFormData(): TObsFormData {
    return this.source.getPropertiesFormData();
  }

  setPropertiesFormData(properties: TObsFormData): void {
    return this.source.setPropertiesFormData(properties);
  }

  hasProps(): boolean {
    return this.source.hasProps();
  }

  setName(newName: string): void {
    return this.source.setName(newName);
  }

  refresh(): void {
    this.source.refresh();
  }

  getModel(): ISourceModel {
    return this.source.getModel();
  }
}
