import { Injectable } from '@angular/core';
import { epochDateTime } from 'idea-toolbox';

import { IDEAErrorReportingService } from './errorReporting.service';
import { IDEAOfflineService } from './offline/offline.service';
import { IDEATinCanService } from './tinCan.service';

// from idea-config.js
declare const IDEA_SOCKET_API_ID: string;
declare const IDEA_SOCKET_API_REGION: string;
declare const IDEA_SOCKET_API_VERSION: string;

/**
 * The URL to connect for socket communication.
 */
export const WEBSOCKET_API_URL =
  `wss://${IDEA_SOCKET_API_ID}.execute-api.${IDEA_SOCKET_API_REGION}.amazonaws.com/` + `${IDEA_SOCKET_API_VERSION}`;

/**
 * To communicate with an AWS API Gateway websocket istance.
 *
 * Note: requires an `AWSAPIAuthToken` variable to be set by IDEATinCanService service.
 */
@Injectable()
export class IDEAAWSAPISocketService {
  /**
   * The current websocket connection.
   */
  protected connection: WebSocket;
  /**
   * The options with which we opened a connection, to re-open it if needed.
   */
  protected options: IDEAAWSAPISocketServiceOpenOptions;
  /**
   * A timeout to ping the connection every once in a while, to keep it alive.
   */
  protected pingTimeout: any;
  /**
   * The timestamp of last activity for the connection, to make sure to ping it in case it's almost dead.
   */
  protected lastActivityAt: epochDateTime;
  /**
   * A timeout to re-try to open a connection later on, hoping we are online again.
   */
  protected offlineTimeout: any;
  /**
   * Whether the connection was correctly opened at least once.
   */
  protected wasOpenAtLeastOnce: boolean;

  /**
   * The maximum amount of minutes of inactivity after which we ping the connection to keep it alive.
   */
  public MAX_INACTIVITY_MINUTES = 7;
  /**
   * The amount of minutes after which we check if the connection needs to be pinged to be kept alive.
   */
  public KEEP_ALIVE_MINUTES_INTERVAL = 2;
  /**
   * In case we are offline, the amount of minutes after which we check if we are online, so we can re-connect.
   */
  public TRY_AGAIN_OFFLINE_MINUTES = 3;

  constructor(
    protected tc: IDEATinCanService,
    protected errorReporting: IDEAErrorReportingService,
    protected offline: IDEAOfflineService
  ) {}

  /**
   * Open a connection to the websocket API.
   */
  public open(options?: IDEAAWSAPISocketServiceOpenOptions) {
    this.options = options || this.options || {};
    // skip in case we have an open and valid connection
    if (this.connection && this.isOpen()) return;
    // prepare optional query params for the connection/authorization request
    let qp = '';
    Object.entries(this.options.openParams || {}).forEach(([key, value]) => (qp += `&${key}=${String(value)}`));
    // open a connection
    this.connection = new WebSocket(WEBSOCKET_API_URL.concat('?Authorization=', this.tc.get('AWSAPIAuthToken'), qp));
    // set the event listeners
    this.connection.onopen = (event: any) => {
      if (this.options.debug) console.log('WEBSOCKET IS OPEN', event);
      // reset the try-again-when-offline mechanism, since we are online and connected
      if (this.offlineTimeout) clearTimeout(this.offlineTimeout);
      this.offlineTimeout = null;
      // mark the start of the connection as the first activity time
      this.lastActivityAt = Date.now();
      // set a timer that every N minutes checks if we need to ping the connection to keep it alive
      this.pingTimeout = setTimeout(() => this.keepItAlive(), this.minutesToMS(this.KEEP_ALIVE_MINUTES_INTERVAL));
      // set the connection as correctly opened at least once (for re-connecting scenarios)
      this.wasOpenAtLeastOnce = true;
      // run the user-defined onOpen actions
      if (this.options.onOpen) this.options.onOpen(event);
    };
    this.connection.onclose = (event: any) => {
      if (this.options.debug) console.log('WEBSOCKET WAS CLOSED BY EXTERNAL EVENTS', event);
      // run the user-defined onClose actions
      if (this.options.onClose) this.options.onClose(event);
      // in case the connection was closed by other events (e.g. offline) reset the data and try to re-open the socket
      this.close(this.wasOpenAtLeastOnce);
    };
    this.connection.onerror = (event: any) => {
      if (this.options.debug) console.log('WEBSOCKET HAD AN ERROR', event);
      // send an error report, if requested
      if (this.options.reportError) {
        const errMsg = ''.concat(event?.target?.url, ' @@@ ', this.tc.get('user')?.userId || this.tc.get('userId'));
        this.errorReporting.sendReport(new Error(errMsg));
      }
      // run the user-defined onError actions
      if (this.options.onError) this.options.onError(event);
    };
    this.connection.onmessage = (event: any) => {
      if (this.options.debug) console.log('WEBSOCKET INCOMING MESSAGE', event);
      try {
        const data = JSON.parse(event.data || {});
        if (this.options.onMessage) this.options.onMessage(data);
      } catch (err) {
        /* IGNORE: it probably comes from a keep-alive ping-pong message */
      }
      this.lastActivityAt = Date.now();
    };
  }

  /**
   * Close the current connection to the websocket API.
   * @param itShouldReopen in case the connection was forcibly closed, try to re-open it (with offline mechanism).
   */
  public close(itShouldReopen?: boolean) {
    // skip in case there isn't an active connection
    if (!this.connection) return;
    // reset the events listener
    this.connection.onopen = null;
    this.connection.onclose = null;
    this.connection.onmessage = null;
    this.connection.onerror = null;
    // in case the connection was closed by a manual action, reset the initial parameters
    if (!itShouldReopen) {
      this.options = null;
      this.wasOpenAtLeastOnce = false;
    }
    // reset the keep-alive mechanism
    if (this.pingTimeout) clearTimeout(this.pingTimeout);
    this.pingTimeout = null;
    this.lastActivityAt = null;
    // reset the try-again-when-offline mechanism
    if (this.offlineTimeout) clearTimeout(this.offlineTimeout);
    this.offlineTimeout = null;
    // close the connection and empty the reference
    this.connection.close();
    this.connection = null;
    // in case the connection was forcibly closed, try to re-open it
    if (itShouldReopen) this.reOpen();
  }
  /**
   * Try to-reopen a closed connection, if we are online.
   */
  protected async reOpen() {
    // in case we are online, reopen the connection right away
    const isOnline = await this.offline.check();
    if (this.options.debug) console.log('WEBSOCKET WILL TRY TO RE-OPEN', isOnline, new Date());
    if (isOnline) return this.open();
    // if we are offline, set a timer to try to re-open the connection later on
    this.offlineTimeout = setTimeout(() => this.reOpen(), this.minutesToMS(this.TRY_AGAIN_OFFLINE_MINUTES));
  }

  /**
   * Whether the socket connection is currently open.
   */
  public isOpen(): boolean {
    return this.connection && this.connection.readyState === WebSocket.OPEN;
  }

  /**
   * A simple message delivered to the server to keep the connection alive.
   */
  protected ping() {
    if (this.options.debug) console.log('WEBSOCKET IS PINGING THE SERVER', new Date());
    this.connection.send('ping');
  }

  /**
   * Helper to keep the connection alive, if needed.
   */
  protected keepItAlive() {
    if (this.options.debug) console.log('WEBSOCKET KEEP-IT-ALIVE', new Date());
    // if there wasn't an acivity in the last MAX_INACTIVITY_MINUTES, ping the connection
    if (!this.lastActivityAt || this.lastActivityAt + this.minutesToMS(this.MAX_INACTIVITY_MINUTES) < Date.now())
      this.ping();
    // set again the timer to keep the connection alive
    if (this.pingTimeout) clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => this.keepItAlive(), this.minutesToMS(this.KEEP_ALIVE_MINUTES_INTERVAL));
  }

  /**
   * Convert minutes to milliseconds.
   */
  protected minutesToMS(minutes: number): number {
    return minutes * 60 * 1000;
  }
}

/**
 * The options to open a socket connection and handle its events.
 */
export interface IDEAAWSAPISocketServiceOpenOptions {
  /**
   * Optional parameters needed to be passed to the socket's authorizer to open the connection.
   * Note: the authentication (IDEA standard) is automatically included.
   */
  openParams?: { [key: string]: any };
  /**
   * Action to execute when the connection is confirmed "open" by the server.
   */
  onOpen?: (event: any) => void;
  /**
   * Action to execute when the connection closes (for external events).
   */
  onClose?: (event: any) => void;
  /**
   * Action to execute when a message is delivered from the server.
   */
  onMessage?: (event: any) => void;
  /**
   * Action to execute when an error occurs.
   */
  onError?: (event: any) => void;
  /**
   * If true, report the errors that occur (IDEA standard).
   */
  reportError?: boolean;
  /**
   * Whether to show debug messages.
   */
  debug?: boolean;
}