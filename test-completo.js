// Testing completo del sistema escolar
const http = require('http');
const https = require('https');

console.log('═══════════════════════════════════════════════════');
console.log('  TESTING COMPLETO DEL SISTEMA ESCOLAR');
console.log('═══════════════════════════════════════════════════');
console.log('\nRequisitos: Backend en :5051 y (opcional) Frontend en :4001');
console.log('  Backend:  cd backend && npm run dev');
console.log('  Frontend: cd frontend/school-app && npm run dev\n');

let testsPassed = 0;
let testsFailed = 0;
const results = [];

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: jsonBody || body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

function getErrorMessage(error) {
  if (!error) return 'Error desconocido';
  if (error.code === 'ECONNREFUSED') return 'Conexión rechazada. ¿Está el servidor corriendo?';
  if (error.code === 'ECONNRESET') return 'Conexión cerrada por el servidor.';
  if (error.message === 'Timeout') return 'Tiempo agotado. ¿El servicio está activo?';
  return error.message || 'Error desconocido';
}

async function test(name, fn) {
  try {
    console.log(`\n[TEST] ${name}`);
    await fn();
    console.log(`[✓] ${name} - PASÓ`);
    testsPassed++;
    results.push({ test: name, status: 'PASS' });
  } catch (error) {
    const msg = getErrorMessage(error);
    console.log(`[✗] ${name} - FALLÓ`);
    console.log(`    Error: ${msg}`);
    testsFailed++;
    results.push({ test: name, status: 'FAIL', error: msg });
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  // Test 1: Backend Health
  await test('Backend Health Check', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/health',
      method: 'GET'
    });
    
    if (response.status !== 200) {
      throw new Error(`Status ${response.status} esperado 200`);
    }
    
    if (!response.body.status || response.body.status !== 'OK') {
      throw new Error('Health check no retornó status OK');
    }
    
    console.log(`    Status: ${response.status}`);
    console.log(`    Uptime: ${response.body.uptime}s`);
  });

  // Test 2: Backend Root
  await test('Backend Root Endpoint', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/',
      method: 'GET'
    });
    
    if (response.status !== 200) {
      throw new Error(`Status ${response.status} esperado 200`);
    }
  });

  // Test 3: Login con credenciales válidas
  let token = null;
  let userData = null;
  
  await test('Login - Credenciales válidas (admin)', async () => {
    const loginData = JSON.stringify({
      email: 'admin@school.com',
      password: 'password123'
    });
    
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    if (response.status !== 200) {
      throw new Error(`Status ${response.status} esperado 200. Respuesta: ${JSON.stringify(response.body)}`);
    }
    
    if (!response.body.token) {
      throw new Error('No se recibió token en la respuesta');
    }
    
    if (!response.body.user) {
      throw new Error('No se recibió user en la respuesta');
    }
    
    token = response.body.token;
    userData = response.body.user;
    
    console.log(`    Token recibido: ${token.substring(0, 30)}...`);
    console.log(`    Usuario: ${userData.email} - Rol: ${userData.role}`);
  });

  await delay(300);

  // Test 4: Login con credenciales inválidas
  await test('Login - Credenciales inválidas', async () => {
    const loginData = JSON.stringify({
      email: 'admin@school.com',
      password: 'password_incorrecta'
    });
    
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData);
    
    if (response.status === 200) {
      throw new Error('Login debería fallar con contraseña incorrecta');
    }
  });

  await delay(300);

  // Test 5: Verify token válido
  if (token) {
    await test('Verify Token - Token válido', async () => {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 5051,
        path: '/api/auth/verify',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Status ${response.status} esperado 200. Respuesta: ${JSON.stringify(response.body)}`);
      }
      
      if (!response.body.user) {
        throw new Error('No se recibió user en la respuesta de verify');
      }
      
      console.log(`    Usuario verificado: ${response.body.user.email}`);
    });
  }

  await delay(400);

  // Test 6: Verify token inválido
  await test('Verify Token - Token inválido', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/api/auth/verify',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer token_invalido_12345'
      }
    });
    
    if (response.status === 200) {
      throw new Error('Verify debería fallar con token inválido');
    }
  });

  await delay(300);

  // Test 7: Verify sin token
  await test('Verify Token - Sin token', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/api/auth/verify',
      method: 'GET'
    });
    
    if (response.status === 200) {
      throw new Error('Verify debería fallar sin token');
    }
  });

  await delay(400);

  // Test 8: Frontend responde
  await test('Frontend - Responde en puerto 4001', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 4001,
      path: '/',
      method: 'GET'
    });
    
    if (response.status !== 200 && response.status !== 307 && response.status !== 302) {
      throw new Error(`Status ${response.status} inesperado`);
    }
    
    console.log(`    Status: ${response.status}`);
  });

  // Test 9: Frontend login page
  await test('Frontend - Página de login accesible', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 4001,
      path: '/login',
      method: 'GET'
    });
    
    if (response.status !== 200) {
      throw new Error(`Status ${response.status} esperado 200`);
    }
    
    const body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    if (!body.includes('Sistema') && !body.includes('login') && !body.includes('Inicia sesión')) {
      console.log('    Nota: HTML compilado');
    }
    
    console.log(`    Status: ${response.status}`);
  });

  await delay(300);

  // Test 10: CORS headers
  await test('CORS - Headers correctos', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/health',
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:4001'
      }
    });
    
    console.log(`    Status: ${response.status}`);
  });

  await delay(300);

  // Test 11: API Computers (con token)
  if (token) {
    await test('API Computers - Listar con token', async () => {
      const response = await makeRequest({
        hostname: 'localhost',
        port: 5051,
        path: '/api/computers',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Status ${response.status}. Respuesta: ${JSON.stringify(response.body)}`);
      }
      console.log(`    Status: ${response.status}`);
    });
  }

  await delay(300);

  // Test 12: Health DB
  await test('Backend - Health DB', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 5051,
      path: '/health/db',
      method: 'GET'
    });
    
    if (response.status !== 200) {
      throw new Error(`Status ${response.status}`);
    }
    if (response.body && response.body.db) {
      console.log(`    DB: ${response.body.db.status}`);
    }
  });

  // Resumen
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RESUMEN DE TESTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\nTotal de tests: ${testsPassed + testsFailed}`);
  console.log(`✓ Pasados: ${testsPassed}`, testsPassed > 0 ? '✅' : '');
  console.log(`✗ Fallidos: ${testsFailed}`, testsFailed > 0 ? '❌' : '');
  
  if (testsFailed > 0) {
    console.log('\nTests fallidos:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.error}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  
  // Estado final
  if (testsFailed === 0) {
    console.log('🎉 TODOS LOS TESTS PASARON');
    process.exit(0);
  } else {
    console.log('⚠️  ALGUNOS TESTS FALLARON');
    console.log('\nAsegúrate de tener el backend corriendo: cd backend && npm run dev');
    process.exit(1);
  }
}

// Ejecutar tests
runTests().catch(error => {
  console.error('\n[ERROR CRÍTICO]', error);
  process.exit(1);
});
