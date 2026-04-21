/**
 * Estados posibles de computadoras/notebooks y transiciones permitidas.
 * Usado por rutas de computers y por el frontend (vía GET /statuses).
 */

const COMPUTER_STATUSES = Object.freeze([
  'available',      // Disponible
  'in_use',         // En uso
  'maintenance',    // En mantenimiento
  'out_of_service' // Fuera de servicio
]);

/** Transiciones permitidas: desde cada estado, a qué estados se puede cambiar */
const STATUS_TRANSITIONS = Object.freeze({
  available: ['in_use', 'maintenance', 'out_of_service'],
  in_use: ['available', 'maintenance'],
  maintenance: ['available', 'out_of_service'],
  out_of_service: ['available', 'maintenance']
});

function isValidStatus(status) {
  return COMPUTER_STATUSES.includes(status);
}

function getPossibleNextStatuses(currentStatus) {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

function canTransitionFromTo(from, to) {
  const allowed = STATUS_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

module.exports = {
  COMPUTER_STATUSES,
  STATUS_TRANSITIONS,
  isValidStatus,
  getPossibleNextStatuses,
  canTransitionFromTo
};
