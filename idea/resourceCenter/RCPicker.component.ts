import { Component, Input, SimpleChanges } from '@angular/core';
import IdeaX = require('idea-toolbox');

import { IDEALoadingService } from '../loading.service';
import { IDEAAWSAPIService } from '../AWSAPI.service';
import { IDEATinCanService } from '../tinCan.service';
import { IDEADownloaderURL } from '../downloader/downloader.component';
import { IDEAMessageService } from '../message.service';
import { IDEATranslationsService } from '../translations/translations.service';
import { IDEAOfflineService } from '../offline/offline.service';

@Component({
  selector: 'idea-rc-picker',
  templateUrl: 'RCPicker.component.html',
  styleUrls: ['RCPicker.component.scss']
})
export class IDEARCPickerComponent {
  /**
   * The team from which we want to load the resources. Default: try to guess current team.
   */
  @Input() public team: string;
  /**
   * The folder of which to load the resources.
   */
  @Input() public folder: IdeaX.RCConfiguredFolder;
  /**
   * The array in which we want to add/remove resources.
   */
  @Input() public attachedResources: Array<IdeaX.RCAttachedResource>;
  /**
   * Regulate the mode (view/edit).
   */
  @Input() public editMode: boolean;
  /**
   * The lines attribute of the item.
   */
  @Input() public lines: string;

  /**
   * The resources loaded from the resource center.
   */
  public resources: Array<IdeaX.RCResource>;
  /**
   * The resources mapped into suggestions.
   */
  public resourcesSuggestions: Array<IdeaX.Suggestion>;
  /**
   * Support variable to trigger file downloads.
   */
  public download: IDEADownloaderURL;

  constructor(
    public t: IDEATranslationsService,
    public loading: IDEALoadingService,
    public message: IDEAMessageService,
    public offline: IDEAOfflineService,
    public tc: IDEATinCanService,
    public API: IDEAAWSAPIService
  ) {
    this.team = null;
    this.folder = null;
    this.editMode = false;
    this.attachedResources = null;
    this.lines = 'none';
    this.resources = null;
    this.resourcesSuggestions = null;
    this.download = null;
  }

  /**
   * Load the resources from the resource center.
   */
  public ngOnChanges(changes: SimpleChanges) {
    // load the resources and prepare the suggestions
    if (changes['team'] || changes['folder']) {
      // if the team isn't specified, try to guess it in the usual IDEA's paths
      this.team = this.team || this.tc.get('membership').teamId || this.tc.get('teamId');
      // load the resources from the specified folder and map them into suggestions (for idea-select)
      this.API.getResource(`teams/${this.team}/folders/${this.folder.folderId}/resources`)
        .then((resources: Array<IdeaX.RCResource>) => {
          this.resources = resources;
          this.resourcesSuggestions = resources.map(
            x => new IdeaX.Suggestion({ value: x.resourceId, name: `${x.name}.${x.format}` })
          );
        })
        .catch(() => {});
    }
  }

  /**
   * Add a resource from the picker by its id, if it hasn't been added already.
   */
  public addResource(resourceId: string) {
    // find the resource
    const resource = this.resources.find(r => r.resourceId === resourceId);
    // add it to the array
    if (resource) this.attachedResources.push(new IdeaX.RCAttachedResource(resource));
  }

  /**
   * Remove a resource from the ones previously selected.
   */
  public removeResource(resource: IdeaX.RCAttachedResource) {
    this.attachedResources.splice(this.attachedResources.indexOf(resource), 1);
  }

  /**
   * Request the attached resource and open it.
   */
  public openResource(resource: IdeaX.RCAttachedResource, latestVersion?: boolean) {
    if (!resource) return;
    const body: any = { action: 'GET_DOWNLOAD_URL' };
    if (!latestVersion) body.version = resource.version;
    this.loading.show();
    this.API.patchResource(`teams/${this.team}/folders/${this.folder.folderId}/resources`, {
      resourceId: resource.resourceId,
      body
    })
      .then((res: IdeaX.SignedURL) => (this.download = new IDEADownloaderURL(res.url)))
      .catch(() => this.message.error('IDEA.RESOURCE_CENTER.ERROR_OPENING_RESOURCE'))
      .finally(() => this.loading.hide());
  }

  /**
   * Return the name of an icon representing the format.
   */
  public getFormatIcon(format: IdeaX.RCResourceFormats): string {
    switch (format) {
      case IdeaX.RCResourceFormats.JPG:
      case IdeaX.RCResourceFormats.JPEG:
      case IdeaX.RCResourceFormats.PNG:
        return 'image';
      case IdeaX.RCResourceFormats.PDF:
        return 'document';
      default:
        return 'help';
    }
  }

  /**
   * Return whether it's available a new version of the resource.
   */
  public isResourceNewerVersionAvailable(attachedResource: IdeaX.RCAttachedResource): boolean {
    const latestRes = this.resources.find(x => x.resourceId === attachedResource.resourceId);
    return latestRes && latestRes.version > attachedResource.version;
  }
}
