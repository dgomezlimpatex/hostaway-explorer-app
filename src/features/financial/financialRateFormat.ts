import { decimal } from './financialFormat';
import type { ItemId } from './financialModel';

// Rates are stored in thousandths: 14 500 mills = 14,500 €/h. Products are a percentage.
export const rateMoney = (mills: number) => decimal(mills / 1000, 2, 3) + ' €';
export const formatRate = (item: ItemId, mills: number) => item === 'products' ? decimal(mills / 1000, 0, 3) + '%' : rateMoney(mills);
