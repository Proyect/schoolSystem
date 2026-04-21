/**
 * Tests de integración para /api/auth.
 * Requiere DB_VENDOR=pgmem y JWT_SECRET (configurado en jest.setup).
 */

const request = require('supertest');

describe('POST /api/auth/login', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-min-16-chars';
    process.env.DB_VENDOR = 'pgmem';
    process.env.NODE_ENV = 'development'; // rate limit más permisivo para tests
    const { initDatabase } = require('../scripts/initDb');
    await initDatabase();
    const server = require('../server');
    app = server.app;
  });

  it('rechaza login sin email o password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBeDefined();
      });

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com' })
      .expect(400);
  });

  it('rechaza email inválido', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid', password: 'password123' })
      .expect(400)
      .expect((res) => expect(res.body.error).toMatch(/email|formato/i));
  });

  it('rechaza usuario inexistente', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@school.com', password: 'password123' })
      .expect(400)
      .expect((res) => expect(res.body.error).toMatch(/usuario|encontrado/i));
  });

  it('rechaza contraseña incorrecta', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@school.com', password: 'wrongpassword' })
      .expect(400)
      .expect((res) => expect(res.body.error).toMatch(/contraseña|incorrecta/i));
  });

  it('acepta credenciales correctas y devuelve token y user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@school.com', password: 'password123' })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('admin@school.com');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.id).toBeDefined();
  });
});
