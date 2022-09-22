import { Observable } from 'rxjs/internal/Observable';
import { mergeMap, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Platform } from '@ionic/angular';
import { Browser } from '@capacitor/browser';
import { Auth0User } from 'idea-toolbox';

import { environment as env } from '@env';

@Injectable()
export class IDEAAuth0Service {
  private isAuthenticated: boolean;
  private idToken: string;

  /**
   * The data about the user currently authenticated, if any.
   */
  user: Auth0User;

  constructor(private platform: Platform, private auth0: AuthService) {
    this.auth0.isAuthenticated$.subscribe(isAuthenticated => (this.isAuthenticated = isAuthenticated));
    this.auth0.idTokenClaims$.subscribe(claims => (this.idToken = claims ? claims.__raw : null));
    this.auth0.user$.subscribe(user => (this.user = user ? new Auth0User(user) : null));
  }

  /**
   * The internal Auth0's service.
   */
  get __raw(): AuthService {
    return this.auth0;
  }

  private isMobileDevice(): boolean {
    return this.platform.is('capacitor');
  }

  /**
   * Open (if needed) Auth0's Universal Login page, to authenticate a user.
   * @param afterRedirectTo where to go after a successful login
   */
  goToLogin(afterRedirectTo?: string): void {
    this.isMobileDevice() ? this.loginWithMobile(afterRedirectTo) : this.loginWithSPA(afterRedirectTo);
  }
  private loginWithSPA(afterRedirectTo?: string): void {
    this.auth0.loginWithRedirect({ appState: { target: afterRedirectTo } });
  }
  private loginWithMobile(afterRedirectTo?: string): void {
    this.auth0
      .buildAuthorizeUrl({ redirect_uri: env.auth0.callbackUri, appState: { target: afterRedirectTo } })
      .pipe(mergeMap(url => Browser.open({ url })))
      .subscribe();
  }

  /**
   * Open (if needed) Auth0's Universal Login page, to logout a user.
   */
  goToLogout(): void {
    this.isMobileDevice() ? this.logoutWithMobile() : this.logoutWithSPA();
  }
  private logoutWithSPA(): void {
    this.auth0.logout({ returnTo: document.location.origin });
  }
  private logoutWithMobile(): void {
    this.auth0
      .buildLogoutUrl({ returnTo: env.auth0.callbackUri })
      .pipe(
        tap(url => {
          this.auth0.logout({ localOnly: true });
          Browser.open({ url });
        })
      )
      .subscribe();
  }

  /**
   * Redirect to login if not authenticated.
   * Meant to be used in a Guard; example:
   * ```
    canActivate(_, state: RouterStateSnapshot): Observable<boolean> {
      return this.auth.redirectIfUnauthenticated(state.url);
    }
   * ```
   */
  redirectIfUnauthenticated(afterRedirectUrl: string): Observable<boolean> {
    return this.auth0.isAuthenticated$.pipe(
      tap(loggedIn => {
        if (!loggedIn) this.goToLogin(afterRedirectUrl);
      })
    );
  }

  /**
   * Handle the callback after a login or logout in Auth0 Universal Login page.
   * In order to work, it has to be used in `app.component.ts`, as explained in the following snippet:
   * ```
      export class AppComponent {
        constructor(private ngZone: NgZone, private auth0: IDEAAuth0Service) {
          App.addListener('appUrlOpen', ({ url }): void =>
            this.ngZone.run((): void => this.auth0.handleCallbackOnMobileDevices(url))
          );
        }
      }
   * ```
   */
  handleCallbackOnMobileDevices(url: string): void {
    if (url?.startsWith(env.auth0.callbackUri)) {
      if (url.includes('state=') && (url.includes('error=') || url.includes('code='))) {
        this.auth0
          .handleRedirectCallback(url)
          .pipe(mergeMap((): Promise<void> => Browser.close()))
          .subscribe();
      } else Browser.close();
    }
  }

  /**
   * Get the ID token, to use for authenticating API requests to the back-end.
   */
  getIdToken(): string {
    return this.idToken;
  }
  /**
   * Whether the user is currently authenticated.
   */
  isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }
}
