import { FormsModule } from '@angular/forms';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  SecurityContext,
  ViewChild
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AlertController } from '@ionic/angular/standalone';
import { AngularEditorComponent, AngularEditorConfig, AngularEditorModule } from '@kolkov/angular-editor';
// @ts-ignore
import { docsSoap } from 'docs-soap';
import { IDEAMessageService, IDEATranslatePipe, IDEATranslationsService } from '@idea-ionic/common';

@Component({
  standalone: true,
  imports: [FormsModule, AngularEditorModule, IDEATranslatePipe],
  selector: 'idea-html-editor',
  template: `
    @if (editMode) {
      <angular-editor
        #editor
        [config]="editorConfig"
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
        (input)="contentChange.emit($event.target.innerHTML)"
        (paste)="cleanHTMLCode()"
        [(ngModel)]="text"
      >
        <ng-template #customButtons>
          <ae-toolbar-set>
            <ae-button
              iconClass="fa fa-arrows-h"
              [title]="'IDEA_EDITOR.SELECT_SIZE_FOR_IMAGE' | translate"
              (buttonClick)="askAndApplySizeToSelectedImages()"
            />
          </ae-toolbar-set>
        </ng-template>
      </angular-editor>
    } @else {
      <div class="view" [innerHTML]="sanitizedHtml"></div>
    }
  `,
  styles: [
    `
      ::ng-deep:has(+ #foregroundColorPicker-),
      ::ng-deep:has(+ #backgroundColorPicker-) {
        display: inline !important;
        position: absolute;
        visibility: hidden;
      }
      ::ng-deep {
        .angular-editor-wrapper {
          background-color: transparent !important;
        }
        .angular-editor-toolbar {
          border-color: var(--idea-html-editor-border-color, var(--ion-color-light-shade)) !important;
          background-color: var(--idea-html-editor-toolbar-background-color, var(--ion-color-light)) !important;
          position: sticky;
          top: 0;
          z-index: 1000;
        }
        .angular-editor-textarea {
          background-color: var(--idea-html-editor-background-color, var(--ion-color-light)) !important;
          border-color: var(--idea-html-editor-border-color, var(--ion-color-light-shade)) !important;
          color: var(--idea-html-editor-color, var(--ion-color-light-contrast)) !important;
        }
        .ae-picker-options,
        .ae-picker-label {
          background-color: var(--idea-html-editor-toolbar-background-color, var(--ion-color-light)) !important;
          border-color: var(--idea-html-editor-toolbar-border-color, var(--ion-color-light)) !important;
          color: var(--idea-html-editor-toolbar-color, var(--ion-color-light-contrast)) !important;
        }
        .angular-editor-button {
          background-color: var(--idea-html-editor-button-background-color, var(--ion-color-light)) !important;
          border-color: var(--idea-html-editor-button-border-color, var(--ion-color-light)) !important;
          color: var(--idea-html-editor-button-color, var(--ion-color-light-contrast)) !important;
        }
      }
      div.view {
        margin: var(--idea-html-editor-margin, 0);
        padding: var(--idea-html-editor-padding, 20px);
        background-color: var(--idea-html-editor-background-color, var(--ion-color-white));
        color: var(--idea-html-editor-color, var(--ion-color-text));
        box-shadow: var(--idea-html-editor-box-shadow, none);
        border: var(--idea-html-editor-border-width, 1px) solid
          var(--idea-html-editor-background-color, var(--ion-border-color));
        border-radius: var(--idea-html-editor-border-radius, 0);
      }
    `
  ]
})
export class IDEAHTMLEditorComponent implements OnInit, OnChanges {
  private _sanitizer = inject(DomSanitizer);
  private _alert = inject(AlertController);
  private _translate = inject(IDEATranslationsService);
  private _message = inject(IDEAMessageService);

  /**
   * Whether the parent page is in editMode or not (simplified).
   */
  @Input() editMode = false;
  /**
   * The HTML content.
   */
  @Input() content: string;
  /**
   * Trigger when the HTML content changes.
   */
  @Output() contentChange = new EventEmitter<string>();

  @ViewChild('editor') editor: AngularEditorComponent;

  text: string;

  lastDropPosition: Range | null = null;

  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: false,
    sanitize: true,
    rawPaste: false,
    minHeight: '50vh',
    // @todo should be an Input configuration
    toolbarHiddenButtons: [['customClasses', 'insertVideo', 'insertHorizontalRule', 'removeFormat', 'toggleEditorMode']]
  };

  sanitizedHtml: string;

  ngOnInit(): void {
    this.text = this.content;
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.editMode) this.sanitizedHtml = this._sanitizer.sanitize(SecurityContext.HTML, this.content);
    if (changes.content) this.sanitizedHtml = this._sanitizer.sanitize(SecurityContext.HTML, this.content);
  }

  cleanHTMLCode(): void {
    setTimeout((): void => {
      this.text = docsSoap(this.text);
      this.contentChange.emit(this.text);
    }, 100);
  }

  async askAndApplySizeToSelectedImages(): Promise<void> {
    const applyWidth = (width: number): void => {
      const imagesSelected = this.getSelectedElementsInEditorWithQuerySelectorAll('img');
      if (!imagesSelected.length) return;
      imagesSelected.forEach(img => {
        if (width) img.setAttribute('width', String(width));
        else img.removeAttribute('width');
      });
      this.contentChange.emit(this.editor.textArea.nativeElement.innerHTML);
    };
    const header = this._translate._('IDEA_EDITOR.SELECT_SIZE_FOR_IMAGE');
    const inputs: any = [
      { type: 'radio', label: this._translate._('IDEA_EDITOR.SIZES.SMALL'), value: 300 },
      { type: 'radio', label: this._translate._('IDEA_EDITOR.SIZES.MEDIUM'), value: 800 },
      { type: 'radio', label: this._translate._('IDEA_EDITOR.SIZES.LARGE'), value: 1200 },
      { type: 'radio', label: this._translate._('IDEA_EDITOR.SIZES.ORIGINAL'), value: 0 }
    ];
    const buttons = [
      { text: this._translate._('COMMON.CANCEL'), role: 'cancel' },
      { text: this._translate._('COMMON.CONFIRM'), handler: applyWidth }
    ];
    const alert = await this._alert.create({ header, inputs, buttons });
    alert.present();
  }

  private getSelectedElementsInEditorWithQuerySelectorAll(selectors: string): Element[] {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return [];
    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    let parentElement: Element | null = null;
    if (commonAncestor instanceof Element) parentElement = commonAncestor;
    else if (commonAncestor.parentElement) parentElement = commonAncestor.parentElement;
    if (!parentElement) return [];
    const elements = parentElement.querySelectorAll(selectors);
    const elementsSelected: Element[] = [];
    elements.forEach(element => {
      if (range.intersectsNode(element)) elementsSelected.push(element);
    });
    return elementsSelected;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;

    if (files && files.length > 0) {
      const file = files[0];

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();

        reader.onload = e => {
          const imgSrc = e.target?.result as string;

          this.moveCursorToDropPosition(event);
          this.insertImageAtLastDropPosition(imgSrc);
        };

        reader.readAsDataURL(file);
      } else this._message.warning('IDEA_EDITOR.FILE_NOT_IMAGE');
    }
  }

  private insertImageAtLastDropPosition(imageUrl: string): void {
    if (this.lastDropPosition) this.editor.executeCommand('insertImage', imageUrl);
  }

  moveCursorToDropPosition(event: DragEvent): void {
    const editor = document.querySelector('angular-editor div[contenteditable="true"]') as HTMLElement;

    if (editor) {
      editor.focus();

      const x = event.clientX;
      const y = event.clientY;

      const range = document.caretRangeFromPoint(x, y); // @todo replace deprecated instruction
      if (range) this.lastDropPosition = range;
    }
  }
}
