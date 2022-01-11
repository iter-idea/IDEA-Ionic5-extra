import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { isEmpty } from 'idea-toolbox';
import { IDEAMessageService, IDEALoadingService, IDEATinCanService, IDEATranslationsService } from '@idea-ionic/common';

import { IDEAAuthService } from './auth.service';

import { environment as env } from '@env';

@Component({
  selector: 'idea-sign-up',
  templateUrl: 'signUp.page.html',
  styleUrls: ['auth.scss']
})
export class IDEASignUpPage implements OnInit {
  /**
   * The email address used to identify the new account.
   */
  public email: string;
  /**
   * The password of the new account.
   */
  public password: string;
  /**
   * Whether the agreements have been accepted.
   */
  public agreementsCheck: boolean;
  /**
   * The error message to display in the UI, if any.
   */
  public errorMsg: string;

  constructor(
    public navCtrl: NavController,
    public tc: IDEATinCanService,
    public message: IDEAMessageService,
    public loading: IDEALoadingService,
    public auth: IDEAAuthService,
    public t: IDEATranslationsService
  ) {
    this.email = this.tc.get('email', true);
    this.password = this.tc.get('password', true);
    this.agreementsCheck = false;
  }
  public ngOnInit() {
    if (!env.idea.auth.registrationIsPossible) return this.goToAuth();
    // if there isn't any agreement to agree to, set the check true
    this.agreementsCheck =
      this.t._('IDEA_VARIABLES.TERMS_AND_CONDITIONS_URL') || this.t._('IDEA_VARIABLES.PRIVACY_POLICY_URL')
        ? this.agreementsCheck
        : true;
  }

  /**
   * Register the new user in cognito (note DynamoDB still need to be managed).
   */
  public async register() {
    this.errorMsg = null;
    // check the fields
    if (isEmpty(this.email, 'email')) this.errorMsg = this.t._('IDEA_AUTH.VALID_EMAIL_OBLIGATORY');
    else if (!this.password || this.password.length < 8)
      this.errorMsg = this.t._('IDEA_AUTH.PASSWORD_POLICY_VIOLATION', { n: 8 });
    // output the error, if there was one
    if (this.errorMsg) return this.message.error('IDEA_AUTH.REGISTRATION_FAILED');
    // start the registration
    await this.loading.show();
    this.auth
      .register(this.email, this.password)
      .then(() => {
        this.message.success('IDEA_AUTH.REGISTRATION_COMPLETED');
        this.tc.set('newAccountRegistered', this.email);
        this.goToAuth();
      })
      .catch(err => {
        // show the unexpected error on screen (english)
        this.errorMsg = err.message;
        this.message.error('IDEA_AUTH.REGISTRATION_FAILED');
      })
      .finally(() => this.loading.hide());
  }

  /**
   * Go to the resend link page.
   */
  public goToResendLink() {
    this.navCtrl.navigateForward(['auth/resend-link']);
  }
  /**
   * Go to auth page.
   */
  public goToAuth() {
    this.navCtrl.navigateBack(['auth']);
  }
}
