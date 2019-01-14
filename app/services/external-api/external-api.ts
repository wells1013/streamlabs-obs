import { Service } from '../service';
import { IObsListOption } from '../../components/obs/inputs/ObsInput';
import { Observable } from 'rxjs';
import { ISource, ISourceApi, ISourceCreateOptions, SourcesService, TSourceType } from '../sources';
import { Inject } from '../../util/injector';


export class ExternalApiService extends Service {

  getResource() {
  }

}

abstract class ExternalApiResource<TSlobsResource> {
  abstract resource: TSlobsResource;
}


class SLSourcesService extends ExternalApiResource<ISourcesServiceApi> {

  @Inject() protected sourcesService: SourcesService;

  createSource(
    name: string,
    type: TSourceType,
    settings?: Dictionary<any>,
    options?: ISourceCreateOptions
  ): SLSource
  {
    const source = this.sourcesService.createSource(name, type, settings, options);
    return this.getSource(source.sourceId);
  }

  getSource(sourceId: string): SLSource {
    const source = this.sourcesService.getSource(sourceId);
    return source ? sour
  }

  removeSource(id: string): void;
  getAvailableSourcesTypes(): TSourceType[];
  getAvailableSourcesTypesList(): IObsListOption<TSourceType>[];
  getSources(): ISourceApi[];
  getSourcesByName(name: string): ISourceApi[];

  /**
   * creates a source from a file
   * source type depends on the file extension
   */
  addFile(path: string): ISourceApi;
  suggestName(name: string): string;
  showSourceProperties(sourceId: string): void;
  showShowcase(): void;
  showAddSource(sourceType: TSourceType): void;
  sourceAdded: Observable<ISource>;
  sourceUpdated: Observable<ISource>;
  sourceRemoved: Observable<ISource>;
}

interface ISourceModel {

}

class SLSource extends ExternalApiResource<ISourceApi> implements ISourceModel {

}

export interface ISourcesServiceApi {
  createSource(
    name: string,
    type: TSourceType,
    settings?: Dictionary<any>,
    options?: ISourceCreateOptions
  ): ISourceApi;
  removeSource(id: string): void;
  getAvailableSourcesTypes(): TSourceType[];
  getAvailableSourcesTypesList(): IObsListOption<TSourceType>[];
  getSources(): ISourceApi[];
  getSource(sourceId: string): ISourceApi;
  getSourcesByName(name: string): ISourceApi[];

  /**
   * creates a source from a file
   * source type depends on the file extension
   */
  addFile(path: string): ISourceApi;
  suggestName(name: string): string;
  showSourceProperties(sourceId: string): void;
  showShowcase(): void;
  showAddSource(sourceType: TSourceType): void;
  sourceAdded: Observable<ISource>;
  sourceUpdated: Observable<ISource>;
  sourceRemoved: Observable<ISource>;
}
