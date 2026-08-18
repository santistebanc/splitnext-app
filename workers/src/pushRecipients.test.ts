import { describe, expect, it } from 'vitest';
import { pushRecipientTokens } from './pushRecipients';

describe('pushRecipientTokens', () => {
  it('excludes the actor device', () => {
    expect(
      pushRecipientTokens(
        [
          { device_user_id: 'd1', expo_push_token: 't1' },
          { device_user_id: 'd2', expo_push_token: 't2' },
        ],
        [
          { device_user_id: 'd1', member_id: 'm1', deleted_at: null },
          { device_user_id: 'd2', member_id: 'm2', deleted_at: null },
        ],
        'd1',
        'm1',
      ),
    ).toEqual(['t2']);
  });

  it('excludes every device bound to the actor member', () => {
    expect(
      pushRecipientTokens(
        [
          { device_user_id: 'd1', expo_push_token: 't1' },
          { device_user_id: 'd2', expo_push_token: 't2' },
        ],
        [
          { device_user_id: 'd2', member_id: 'm1', deleted_at: null },
          { device_user_id: 'd3', member_id: 'm3', deleted_at: null },
        ],
        'd1',
        'm1',
      ),
    ).toEqual([]);
  });

  it('dedupes identical expo tokens', () => {
    expect(
      pushRecipientTokens(
        [
          { device_user_id: 'd2', expo_push_token: 'same' },
          { device_user_id: 'd3', expo_push_token: 'same' },
        ],
        [
          { device_user_id: 'd2', member_id: 'm2', deleted_at: null },
          { device_user_id: 'd3', member_id: 'm3', deleted_at: null },
        ],
        'd1',
        'm1',
      ),
    ).toEqual(['same']);
  });
});
