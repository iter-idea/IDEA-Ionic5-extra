import { Component, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { OverlayEventDetail } from '@ionic/core';
import { ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TimeInterval } from 'idea-toolbox';

import { IDEATranslationsService } from '../translations/translations.service';

import { IDEAFromTimeToTimeComponent } from './fromTimeToTime.component';

@Component({
  selector: 'idea-time-interval',
  templateUrl: 'timeInterval.component.html',
  styleUrls: ['timeInterval.component.scss']
})
export class IDEATimeIntervalComponent {
  /**
   * The time interval to set.
   */
  @Input() public timeInterval: TimeInterval;
  /**
   * Whether we should start picking the time displaying the afternoon (PM) or the morning (AM, default).
   */
  @Input() public pm: boolean;
  /**
   * A time to use as lower limit for the possible choices.
   */
  @Input() public notEarlierThan: number;
  /**
   * A time to use as upper limit for the possible choices.
   */
  @Input() public notLaterThan: number;
  /**
   * The label for the field.
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
   * If true, the component is disabled.
   */
  @Input() public disabled: boolean;
  /**
   * If true, the field has a tappable effect when disabled.
   */
  @Input() public tappableWhenDisabled: boolean;
  /**
   * If true, the obligatory dot is shown.
   */
  @Input() public obligatory: boolean;
  /**
   * Lines preferences for the item.
   */
  @Input() public lines: string;
  /**
   * On select event.
   */
  @Output() public select = new EventEmitter<void>();
  /**
   * Icon select.
   */
  @Output() public iconSelect = new EventEmitter<void>();
  /**
   * On select (with the field disabled) event.
   */
  @Output() public selectWhenDisabled = new EventEmitter<void>();
  /**
   * The value to display in the field preview.
   */
  public valueToDisplay: string;
  /**
   * Language change subscription.
   */
  protected langChangeSubscription: Subscription;

  constructor(public modalCtrl: ModalController, public t: IDEATranslationsService) {}

  public ngOnInit() {
    // when the language changes, set the locale
    this.langChangeSubscription = this.t.onLangChange.subscribe(() => {
      this.valueToDisplay = this.getValueToDisplay(this.timeInterval);
    });
  }
  public ngOnDestroy() {
    if (this.langChangeSubscription) this.langChangeSubscription.unsubscribe();
  }
  public ngOnChanges(changes: SimpleChanges) {
    if (changes.timeInterval) this.valueToDisplay = this.getValueToDisplay(changes.timeInterval.currentValue);
  }

  /**
   * Get the value to show for the interval.
   */
  protected getValueToDisplay(timeInterval: TimeInterval): string {
    if (!timeInterval || !timeInterval.isSet()) return '';
    // since the dates are stored as UTC, we need to add the current timezone
    const timeZoneOffset = new Date().getTimezoneOffset() * 60000;
    return (
      `${this.t._('IDEA.FTTT.FROM')} ${this.t.formatDate(timeInterval.from + timeZoneOffset, 'shortTime')} ` +
      `${this.t._('IDEA.FTTT.TO').toLowerCase()} ${this.t.formatDate(timeInterval.to + timeZoneOffset, 'shortTime')}`
    );
  }

  /**
   * Pick the time interval.
   */
  public pickTimeInterval() {
    this.modalCtrl
      .create({
        component: IDEAFromTimeToTimeComponent,
        componentProps: {
          timeInterval: this.timeInterval,
          pm: this.pm,
          notEarlierThan: this.notEarlierThan,
          notLaterThan: this.notLaterThan,
          title: this.label
        }
      })
      .then(modal => {
        modal.onDidDismiss().then((res: OverlayEventDetail) => {
          // if the content changed, update the internal values and notify the parent component
          if (res.data === true || res.data === false) {
            this.valueToDisplay = this.getValueToDisplay(this.timeInterval);
            this.select.emit();
          }
        });
        modal.present();
      });
  }

  /**
   * Emit the selection while the component is in viewMode.
   */
  public doSelectWhenDisabled() {
    if (this.disabled) this.selectWhenDisabled.emit();
  }

  /**
   * Emit the selection of the icon.
   */
  public doIconSelect(event: any) {
    if (event) event.stopPropagation();
    this.iconSelect.emit(event);
  }
}