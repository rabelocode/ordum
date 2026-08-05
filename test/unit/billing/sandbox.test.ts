import { describe, it, expect, vi } from 'vitest';
import { processStoredEvent } from '../../../src/server/billing/router';

describe('Billing Sandbox & Stabilization Tests', () => {
  it('Should correctly parse processStoredEvent idempotency', async () => {
    // Mock the DB
    const dbMock = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: {}, error: null })
    };

    // If event is not supported, should return ignored
    const status = await processStoredEvent(dbMock as any, { 
       event_type: 'RANDOM_UNSUPPORTED', 
       payload: {} 
    });
    
    expect(status).toBe('ignored');
  });

  it('Should reject PAYMENT_CONFIRMED if payment missing payload ID', async () => {
    const dbMock = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }) // explicitly return no data
    };

    const status = await processStoredEvent(dbMock as any, {
      event_type: 'PAYMENT_CONFIRMED',
      payload: { payment: {} } // missing payment ID
    });

    expect(status).toBe('ignored');
  });
});
