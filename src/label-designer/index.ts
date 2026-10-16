import { defineLabelDesigner } from './designer';

export { defineLabelDesigner } from './designer';
export type { LabelDesignerElement, LabelItemSource } from './designer';
export { defineLabelPreview } from './preview';
export type { LabelPreviewElement } from './preview';

if (typeof customElements !== 'undefined') defineLabelDesigner();
