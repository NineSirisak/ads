import { describe, it, expect } from 'vitest';
import { formatTicketNumber, parseTicketNumber } from '@/lib/ticketNumber';

describe('formatTicketNumber', () => {
  it('formats a valid advance request number correctly', () => {
    const date = new Date(2026, 6, 4); // July 4, 2026 (month is 0-indexed)
    expect(formatTicketNumber('ADV', date, 7)).toBe('ADV202607040007');
  });

  it('pads sequence to 4 digits', () => {
    const date = new Date(2026, 0, 1);
    expect(formatTicketNumber('BK', date, 1)).toBe('BK202601010001');
  });

  it('throws when sequence is 0', () => {
    expect(() => formatTicketNumber('CI', new Date(), 0)).toThrow();
  });

  it('throws when sequence exceeds 9999', () => {
    expect(() => formatTicketNumber('CO', new Date(), 10000)).toThrow();
  });
});

describe('parseTicketNumber', () => {
  it('parses a valid ticket number', () => {
    const result = parseTicketNumber('ADV202607040007');
    expect(result).toEqual({ prefix: 'ADV', date: '20260704', sequence: 7 });
  });

  it('returns null for malformed ticket number', () => {
    expect(parseTicketNumber('not-a-ticket')).toBeNull();
    expect(parseTicketNumber('ADV2026')).toBeNull();
  });
});
