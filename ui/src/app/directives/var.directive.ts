import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core'

interface VarContext<T> {
  ngVar: T
}

@Directive({
    selector: '[ngVar]',
})
export class VarDirective<T> {
  private _context: VarContext<T> = { ngVar: null}

  constructor (_viewContainer: ViewContainerRef, _templateRef: TemplateRef<VarContext<T>>) {
      _viewContainer.createEmbeddedView(_templateRef, this._context)
  }

  @Input()
  set ngVar (value: T) {
      this._context.ngVar = value
  }
}