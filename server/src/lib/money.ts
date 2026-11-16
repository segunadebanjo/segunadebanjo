import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal | number | string | null | undefined;

/** Convert a DECIMAL value to a JS number for ratio maths / JSON analytics output. */
export const num = (v: Money): number => (v === null || v === undefined ? 0 : Number(v.toString()));

/** Round to 2dp and return a Prisma.Decimal suitable for DECIMAL(12,2) columns. */
export const dec = (v: Money): Prisma.Decimal => new Prisma.Decimal(num(v)).toDecimalPlaces(2);

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Safe division: returns null when the denominator is 0 (so the UI can show "—"). */
export const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);
