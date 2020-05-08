import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import SignaturePad from 'signature_pad';
import IdeaX = require('idea-toolbox');

import { Signature } from './signature.model';
import { IDEAMessageService } from '../message.service';
import { IDEATranslationsService } from '../translations/translations.service';

@Component({
  selector: 'idea-signature',
  templateUrl: 'signature.component.html',
  styleUrls: ['signature.component.scss']
})
export class IDEASignatureComponent {
  /**
   * An existing signature to use.
   */
  @Input() public existingSignature: Signature;
  /**
   * A list of contacts that could be the signatory of this signature.
   */
  @Input() public contacts: Array<string>;
  /**
   * The signature to manage.
   */
  public signature: Signature;
  /**
   * The canvas where the signature is painted.
   */
  public canvas: HTMLCanvasElement;
  /**
   * The signature pad.
   */
  public pad: SignaturePad;
  /**
   * Helper to report an error in the signatory field.
   */
  public signatoryError: boolean;
  /**
   * Helper to report an error in the signature canvas.
   */
  public signatureError: boolean;
  /**
   * Helper to manage contacts suggestions.
   */
  public contactsSuggestions: Array<IdeaX.Suggestion>;

  constructor(
    public modalCtrl: ModalController,
    public message: IDEAMessageService,
    public t: IDEATranslationsService
  ) {
    this.signature = new Signature();
    this.canvas = null;
    this.pad = null;
  }
  public ionViewDidEnter() {
    // prepare the canvas area for the signature
    this.canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement;
    this.pad = new SignaturePad(this.canvas);
    this.resizeCanvas();
    // in case a signature already exists, show it
    if (this.existingSignature) {
      this.signature.load(this.existingSignature);
      this.pad.fromDataURL(this.signature.pngURL);
    }
    // load the contacts suggestions
    this.contactsSuggestions = (this.contacts || []).map(c => new IdeaX.Suggestion({ value: c }));
  }

  /**
   * Clear the canvas.
   */
  public clear() {
    this.pad.clear();
  }

  /**
   * Check Close the window and return the signature (text + different formats).
   */
  public save() {
    this.signatoryError = Boolean(!this.signature.signatory);
    this.signatureError = this.pad.isEmpty();
    if (this.signatoryError || this.signatureError)
      return this.message.warning('IDEA.SIGNATURE.VERIFY_SIGNATORY_AND_SIGNATURE');
    this.signature.jpegURL = this.pad.toDataURL('image/jpeg');
    this.signature.pngURL = this.pad.toDataURL('image/png');
    this.modalCtrl.dismiss(this.signature);
  }

  /**
   * Close and undo the signature.
   */
  public undo() {
    this.modalCtrl.dismiss(true);
  }

  /**
   * Close without saving.
   */
  public close() {
    this.modalCtrl.dismiss();
  }

  /**
   * Handling high DPI screens.
   */
  public resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    this.canvas.width = this.canvas.offsetWidth * ratio;
    this.canvas.height = this.canvas.offsetHeight * ratio;
    this.canvas.getContext('2d').scale(ratio, ratio);
    this.pad.clear();
  }
}
