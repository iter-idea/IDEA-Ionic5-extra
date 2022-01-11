import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Label, mdToHtml, StringVariable } from 'idea-toolbox';

import { IDEATranslationsService } from '../translations/translations.service';

import { IDEALabelerComponent } from './labeler.component';

/**
 * Manage the content of a Label.
 */
@Component({
  selector: 'idea-label',
  templateUrl: 'label.component.html',
  styleUrls: ['label.component.scss']
})
export class IDEALabelComponent implements OnInit {
  /**
   * The label to manage. The name is set to not overlap with IDEA's components typical use of the attribute `label`.
   */
  @Input() public content: Label;
  /**
   * Whether to display the label in textareas instead of text fields.
   */
  @Input() public textarea: boolean;
  /**
   * Whether the label supports markdown.
   */
  @Input() public markdown: boolean;
  /**
   * The variables the user can use in the label.
   */
  @Input() public variables: StringVariable[];
  /**
   * The title (label) for the field.
   */
  @Input() public label: string;
  /**
   * The icon for the field.
   */
  @Input() public icon: string;
  /**
   * The color of the icon.
   */
  @Input() public iconColor: string;
  /**
   * A placeholder for the field.
   */
  @Input() public placeholder: string;
  /**
   * Lines preferences for the item.
   */
  @Input() public lines: string;
  /**
   * If true, the component is disabled.
   */
  @Input() public disabled: boolean;
  /**
   * If true, the label is validated on save.
   */
  @Input() public obligatory: boolean;
  /**
   * On change event.
   */
  @Output() public change = new EventEmitter<void>();
  /**
   * Icon select.
   */
  @Output() public iconSelect = new EventEmitter<void>();
  /**
   * The list of variables codes to use for substitutions.
   */
  public _variables: string[];
  /**
   * The label's HTML content to display.
   */
  public htmlContent: string;

  constructor(public modalCtrl: ModalController, public t: IDEATranslationsService) {}
  public ngOnInit() {
    // create a plain list of variable codes
    this._variables = (this.variables || []).map(x => x.code);
    // init the HTML content of the label
    this.calcContent();
  }

  /**
   * Open the modal to edit the label.
   */
  public edit() {
    this.modalCtrl
      .create({
        component: IDEALabelerComponent,
        componentProps: {
          label: this.content,
          textarea: this.textarea,
          markdown: this.markdown,
          variables: this.variables,
          title: this.label,
          obligatory: this.obligatory,
          disabled: this.disabled,
          lines: this.lines
        }
      })
      .then(modal => {
        modal.onDidDismiss().then(res => {
          if (res?.data) {
            this.calcContent();
            this.change.emit();
          }
        });
        modal.present();
      });
  }

  /**
   * Calculate the HTML content of the label.
   */
  private calcContent() {
    const str = this.content.translate(this.t.getCurrentLang(), this.t.languages());
    this.htmlContent = str && this.markdown ? mdToHtml(str) : str;
  }

  /**
   * The icon was selected.
   */
  public doIconSelect(event: any) {
    if (event) event.stopPropagation();
    this.iconSelect.emit(event);
  }
}
