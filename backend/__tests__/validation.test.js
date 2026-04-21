const { isValidEmail, sanitizeText } = require('../middleware/validation');

describe('isValidEmail', () => {
  it('acepta emails válidos', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('admin@school.com')).toBe(true);
    expect(isValidEmail('a+b@test.co')).toBe(true);
  });

  it('rechaza emails inválidos', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('sinarroba')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@.com')).toBe(false);
  });
});

describe('sanitizeText', () => {
  it('elimina espacios y caracteres peligrosos', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
    expect(sanitizeText('a<b>c')).toBe('abc'); // solo se quitan < y >
    expect(sanitizeText('script')).toBe('script');
  });

  it('devuelve string vacío para no-string', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(123)).toBe('');
  });
});
