import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import IdeaX = require('idea-toolbox');

// from idea-config.js
declare const IDEA_PROJECT: string;
declare const IDEA_API_VERSION: string;
declare const IDEA_ERROR_REPORTING_API_URL: string;

@Injectable()
export class IDEAErrorReportingService {
  constructor(public http: HttpClient) {}

  public sendReport(error: Error, forceSend?: boolean): Promise<any> {
    return new Promise((resolve) => {
      if (!this.shouldSend() && !forceSend) return resolve();
      const report = new IdeaX.IDEAErrorReport();
      report.load({ project: IDEA_PROJECT, error: error, client: this.getClientInfo() });
      this.http.post(IDEA_ERROR_REPORTING_API_URL, report)
      .toPromise()
      .catch(() => {})
      .finally(() => resolve()); // note: never throw an error when reporting an error
    });
  }

  protected shouldSend(): boolean {
    return IDEA_API_VERSION && IDEA_API_VERSION === 'prod';
  }

  public getClientInfo(): IdeaX.IDEAClientInfo {
    return new IdeaX.IDEAClientInfo({
      timestamp: new Date(),
      timezone: (new Date()).getTimezoneOffset() / 60,
      pageOn: window.location.pathname,
      referrer: document.referrer,
      browserName: navigator.appName,
      browserEngine: navigator.product,
      browserVersion: navigator.appVersion,
      browserUserAgent: navigator.userAgent,
      browserLanguage: navigator.language,
      browserOnline: navigator.onLine,
      browserPlatform:  navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      screenColorDepth: screen.colorDepth,
      screenPixelDepth: screen.pixelDepth
    });
  }
}
