// Test simple del sistema
const http = require('http');

console.log('=== TESTING DEL SISTEMA ===\n');

// Test 1: Backend health
console.log('1. Probando backend...');
const backendReq = http.get('http://localhost:5051/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('   ✓ Backend OK:', data);
    
    // Test 2: Login
    console.log('\n2. Probando login...');
    const loginData = JSON.stringify({
      email: 'admin@school.com',
      password: 'password123'
    });
    
    const loginReq = http.request({
      hostname: 'localhost',
      port: 5051,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(data);
          console.log('   ✓ Login OK - Token recibido');
          console.log('   Usuario:', result.user.email, '- Rol:', result.user.role);
          
          // Test 3: Verify
          console.log('\n3. Probando verificación...');
          const verifyReq = http.request({
            hostname: 'localhost',
            port: 5051,
            path: '/api/auth/verify',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${result.token}`
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) {
                console.log('   ✓ Verificación OK');
              } else {
                console.log('   ✗ Verificación falló:', res.statusCode, data);
              }
              console.log('\n=== FIN DEL TEST ===');
            });
          });
          verifyReq.on('error', (e) => {
            console.log('   ✗ Error en verify:', e.message);
            console.log('\n=== FIN DEL TEST ===');
          });
          verifyReq.end();
        } else {
          console.log('   ✗ Login falló:', res.statusCode, data);
          console.log('\n=== FIN DEL TEST ===');
        }
      });
    });
    
    loginReq.on('error', (e) => {
      console.log('   ✗ Error en login:', e.message);
      console.log('\n=== FIN DEL TEST ===');
    });
    
    loginReq.write(loginData);
    loginReq.end();
  });
});

backendReq.on('error', (e) => {
  console.log('   ✗ Backend no responde:', e.message);
  console.log('\n=== FIN DEL TEST ===');
});
