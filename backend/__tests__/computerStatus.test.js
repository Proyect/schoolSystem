const {
  COMPUTER_STATUSES,
  isValidStatus,
  getPossibleNextStatuses,
  canTransitionFromTo
} = require('../constants/computerStatus');

describe('computerStatus', () => {
  it('define los estados esperados', () => {
    expect(COMPUTER_STATUSES).toContain('available');
    expect(COMPUTER_STATUSES).toContain('in_use');
    expect(COMPUTER_STATUSES).toContain('maintenance');
    expect(COMPUTER_STATUSES).toContain('out_of_service');
    expect(COMPUTER_STATUSES).toHaveLength(4);
  });

  it('isValidStatus acepta solo estados válidos', () => {
    expect(isValidStatus('available')).toBe(true);
    expect(isValidStatus('in_use')).toBe(true);
    expect(isValidStatus('maintenance')).toBe(true);
    expect(isValidStatus('out_of_service')).toBe(true);
    expect(isValidStatus('invalid')).toBe(false);
    expect(isValidStatus('')).toBe(false);
  });

  it('getPossibleNextStatuses devuelve transiciones correctas', () => {
    expect(getPossibleNextStatuses('available')).toEqual(['in_use', 'maintenance', 'out_of_service']);
    expect(getPossibleNextStatuses('in_use')).toEqual(['available', 'maintenance']);
    expect(getPossibleNextStatuses('maintenance')).toEqual(['available', 'out_of_service']);
    expect(getPossibleNextStatuses('out_of_service')).toEqual(['available', 'maintenance']);
    expect(getPossibleNextStatuses('unknown')).toEqual([]);
  });

  it('canTransitionFromTo valida transiciones', () => {
    expect(canTransitionFromTo('available', 'in_use')).toBe(true);
    expect(canTransitionFromTo('available', 'maintenance')).toBe(true);
    expect(canTransitionFromTo('in_use', 'available')).toBe(true);
    expect(canTransitionFromTo('in_use', 'out_of_service')).toBe(false);
    expect(canTransitionFromTo('maintenance', 'in_use')).toBe(false);
  });
});
