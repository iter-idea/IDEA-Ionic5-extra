import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IDEAApiService } from '@idea-ionic/common';

import { IDEAAuth0Service } from './auth0.service';

export const auth0Guard: CanActivateFn = async (
  _: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean> => {
  const auth = inject(IDEAAuth0Service);
  const api = inject(IDEAApiService);

  if (!api.authToken)
    api.authToken = async (): Promise<string> => {
      try {
        const { __raw: token } = await firstValueFrom(auth.__raw.idTokenClaims$);
        return token;
      } catch (error) {
        auth.goToLogin(state.url);
        return null;
      }
    };

  const isAuthenticated = await firstValueFrom(auth.__raw.isAuthenticated$);

  if (!isAuthenticated) {
    auth.goToLogin(state.url);
    return false;
  } else return true;
};
