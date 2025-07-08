const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  
  next();
};

const validateComputer = (req, res, next) => {
  const { code, description } = req.body;
  
  if (!code || !description) {
    return res.status(400).json({ error: 'Código y descripción son requeridos' });
  }
  
  if (code.length < 3) {
    return res.status(400).json({ error: 'El código debe tener al menos 3 caracteres' });
  }
  
  next();
};

module.exports = { validateLogin, validateComputer }; 