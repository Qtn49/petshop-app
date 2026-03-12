/** Invoice import flow steps: 1 = Invoice review, 2 = Square matching, 3 = Product confirmation & PO */
export const STEP_1_INVOICE_REVIEW = 1;
export const STEP_2_SQUARE_MATCHING = 2;
export const STEP_3_CONFIRMATION = 3;

export const CONFIRM_ITEMS_STORAGE_KEY = 'petshop_confirm_items';

export function getConfirmItemsKey(invoiceId: string): string {
  return `${CONFIRM_ITEMS_STORAGE_KEY}_${invoiceId}`;
}
