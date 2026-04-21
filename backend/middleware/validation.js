// Función auxiliar para validar email
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// Función auxiliar para sanitizar texto
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/[<>]/g, '');
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }
  
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email y contraseña deben ser texto' });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }
  
  if (password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 128 caracteres' });
  }
  
  // Sanitizar entrada
  req.body.email = email.toLowerCase().trim();
  
  next();
};

const validateComputer = (req, res, next) => {
  const { code, description, serial_number, hardware_id } = req.body;
  
  if (!code || !description) {
    return res.status(400).json({ error: 'Código y descripción son requeridos' });
  }
  
  if (typeof code !== 'string' || typeof description !== 'string') {
    return res.status(400).json({ error: 'Código y descripción deben ser texto' });
  }
  
  if (code.length < 3 || code.length > 20) {
    return res.status(400).json({ error: 'El código debe tener entre 3 y 20 caracteres' });
  }
  
  if (description.length < 5 || description.length > 255) {
    return res.status(400).json({ error: 'La descripción debe tener entre 5 y 255 caracteres' });
  }
  
  if (serial_number != null && (typeof serial_number !== 'string' || serial_number.length > 100)) {
    return res.status(400).json({ error: 'Número de serie debe ser texto de hasta 100 caracteres' });
  }
  
  if (hardware_id != null && (typeof hardware_id !== 'string' || hardware_id.length > 100)) {
    return res.status(400).json({ error: 'ID de hardware debe ser texto de hasta 100 caracteres' });
  }
  
  // Validar que el código solo contenga caracteres alfanuméricos y guiones
  if (!/^[a-zA-Z0-9-_]+$/.test(code)) {
    return res.status(400).json({ error: 'El código solo puede contener letras, números, guiones y guiones bajos' });
  }
  
  // Sanitizar entrada
  req.body.code = sanitizeText(code).toUpperCase();
  req.body.description = sanitizeText(description);
  req.body.serial_number = serial_number ? sanitizeText(serial_number) : null;
  req.body.hardware_id = hardware_id ? sanitizeText(hardware_id) : null;
  
  next();
};

const validateReservation = (req, res, next) => {
  const { computer_id, start_time, end_time } = req.body;
  
  if (!computer_id || !start_time || !end_time) {
    return res.status(400).json({ error: 'ID de computadora, hora de inicio y fin son requeridos' });
  }
  
  // Validar que computer_id sea un número entero
  const computerId = parseInt(computer_id);
  if (isNaN(computerId) || computerId <= 0) {
    return res.status(400).json({ error: 'ID de computadora debe ser un número entero válido' });
  }
  
  // Validar formato de fechas ISO 8601
  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  const now = new Date();
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Formato de fechas inválido. Use formato ISO 8601 (YYYY-MM-DDTHH:mm:ss)' });
  }
  
  // Validar que las fechas sean válidas (no fechas futuras muy lejanas)
  const maxFutureDate = new Date();
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 3); // Máximo 3 meses en el futuro
  
  if (startDate > maxFutureDate) {
    return res.status(400).json({ error: 'No se pueden hacer reservas más de 3 meses en el futuro' });
  }
  
  if (startDate >= endDate) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
  }
  
  if (startDate < now) {
    return res.status(400).json({ error: 'No se pueden hacer reservas en el pasado' });
  }
  
  // Validar duración mínima (15 minutos) y máxima (4 horas)
  const duration = (endDate - startDate) / (1000 * 60 * 60);
  if (duration < 0.25) {
    return res.status(400).json({ error: 'La reserva debe ser de al menos 15 minutos' });
  }
  if (duration > 4) {
    return res.status(400).json({ error: 'La reserva no puede exceder 4 horas' });
  }
  
  // Validar que las fechas estén en intervalos de 15 minutos
  const startMinutes = startDate.getMinutes();
  const endMinutes = endDate.getMinutes();
  if (startMinutes % 15 !== 0 || endMinutes % 15 !== 0) {
    return res.status(400).json({ error: 'Las reservas deben estar en intervalos de 15 minutos' });
  }
  
  // Sanitizar entrada
  req.body.computer_id = computerId;
  
  next();
};

const validateUser = (req, res, next) => {
  const { email, password, first_name, last_name, role } = req.body;
  
  if (!email || !first_name || !last_name) {
    return res.status(400).json({ error: 'Email, nombre y apellido son requeridos' });
  }
  
  // Validar tipos de datos
  if (typeof email !== 'string' || typeof first_name !== 'string' || typeof last_name !== 'string') {
    return res.status(400).json({ error: 'Email, nombre y apellido deben ser texto' });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Formato de email inválido' });
  }
  
  // Validar longitud de nombres
  if (first_name.length < 2 || first_name.length > 50) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 50 caracteres' });
  }
  
  if (last_name.length < 2 || last_name.length > 50) {
    return res.status(400).json({ error: 'El apellido debe tener entre 2 y 50 caracteres' });
  }
  
  // Validar que nombres solo contengan letras, espacios y algunos caracteres especiales
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/.test(first_name)) {
    return res.status(400).json({ error: 'El nombre solo puede contener letras, espacios, guiones y apostrofes' });
  }
  
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/.test(last_name)) {
    return res.status(400).json({ error: 'El apellido solo puede contener letras, espacios, guiones y apostrofes' });
  }
  
  // Validar contraseña si se proporciona
  if (password) {
    if (typeof password !== 'string') {
      return res.status(400).json({ error: 'La contraseña debe ser texto' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 128 caracteres' });
    }
  }
  
  // Validar rol
  if (role && !['admin', 'teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido. Los roles válidos son: admin, teacher, student' });
  }
  
  // Sanitizar entrada
  req.body.email = email.toLowerCase().trim();
  req.body.first_name = sanitizeText(first_name);
  req.body.last_name = sanitizeText(last_name);
  
  next();
};

// Función auxiliar para validar IDs numéricos
const validateId = (id, fieldName = 'ID') => {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    throw new Error(`${fieldName} debe ser un número entero válido`);
  }
  return numId;
};

// Middleware para validar parámetros de ruta (IDs)
const validateParams = (req, res, next) => {
  try {
    // Validar ID en parámetros de ruta
    if (req.params.id) {
      req.params.id = validateId(req.params.id, 'ID');
    }
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

// Middleware para validar query parameters
const validateQuery = (req, res, next) => {
  try {
    const { page, limit, user_id, computer_id } = req.query;
    
    // Validar paginación
    if (page) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'El parámetro page debe ser un número mayor a 0' });
      }
      req.query.page = pageNum;
    }
    
    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
        return res.status(400).json({ error: 'El parámetro limit debe ser un número entre 1 y 1000' });
      }
      req.query.limit = limitNum;
    }
    
    // Validar IDs en query
    if (user_id) {
      req.query.user_id = validateId(user_id, 'User ID');
    }
    
    if (computer_id) {
      req.query.computer_id = validateId(computer_id, 'Computer ID');
    }
    
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

module.exports = { 
  validateLogin, 
  validateComputer, 
  validateReservation, 
  validateUser,
  validateParams,
  validateQuery,
  isValidEmail,
  sanitizeText
}; 