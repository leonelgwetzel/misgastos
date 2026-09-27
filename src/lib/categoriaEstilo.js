const ICONOS = [
  { id: 'fa-tag', label: 'Etiqueta' },
  { id: 'fa-utensils', label: 'Comida' },
  { id: 'fa-cart-shopping', label: 'Supermercado' },
  { id: 'fa-mug-hot', label: 'Café' },
  { id: 'fa-car', label: 'Auto' },
  { id: 'fa-gas-pump', label: 'Combustible' },
  { id: 'fa-bus', label: 'Transporte' },
  { id: 'fa-plane', label: 'Viajes' },
  { id: 'fa-house', label: 'Vivienda' },
  { id: 'fa-bolt', label: 'Servicios' },
  { id: 'fa-wifi', label: 'Internet' },
  { id: 'fa-mobile-screen', label: 'Celular' },
  { id: 'fa-heart-pulse', label: 'Salud' },
  { id: 'fa-pills', label: 'Farmacia' },
  { id: 'fa-dumbbell', label: 'Gimnasio' },
  { id: 'fa-graduation-cap', label: 'Educación' },
  { id: 'fa-book', label: 'Libros' },
  { id: 'fa-film', label: 'Entretenimiento' },
  { id: 'fa-gamepad', label: 'Juegos' },
  { id: 'fa-music', label: 'Música' },
  { id: 'fa-shirt', label: 'Indumentaria' },
  { id: 'fa-gift', label: 'Regalos' },
  { id: 'fa-paw', label: 'Mascotas' },
  { id: 'fa-baby', label: 'Hijos' },
  { id: 'fa-briefcase', label: 'Trabajo' },
  { id: 'fa-credit-card', label: 'Tarjeta' },
  { id: 'fa-piggy-bank', label: 'Ahorro' },
  { id: 'fa-hand-holding-dollar', label: 'Préstamos' },
  { id: 'fa-receipt', label: 'Impuestos' },
  { id: 'fa-screwdriver-wrench', label: 'Mantenimiento' },
  { id: 'fa-scissors', label: 'Cuidado personal' },
  { id: 'fa-ellipsis', label: 'Otros' },
];

const COLORES = [
  '#0f5c56',
  '#14b8a6',
  '#0ea5e9',
  '#2563eb',
  '#8b5cf6',
  '#d946ef',
  '#e11d48',
  '#f97316',
  '#f5c400',
  '#84cc16',
  '#16a34a',
  '#64748b',
];

const ICONO_DEFAULT = 'fa-tag';
const COLOR_DEFAULT = COLORES[0];

const ICONOS_VALIDOS = new Set(ICONOS.map((i) => i.id));
const COLOR_RE = /^#[0-9a-f]{6}$/i;

function esIconoValido(icono) {
  return ICONOS_VALIDOS.has(icono);
}

function esColorValido(color) {
  return COLOR_RE.test(String(color || ''));
}

/** Ícono sugerido a partir del nombre, para categorías sin elección explícita. */
function iconoSugerido(nombre) {
  const n = String(nombre || '').toLowerCase();
  if (/comida|alimento|super|mercado|restau|bar|caf[eé]/.test(n)) return 'fa-utensils';
  if (/transporte|auto|nafta|uber|taxi|viaje|combustible/.test(n)) return 'fa-car';
  if (/vivienda|alquiler|casa|hogar|rent/.test(n)) return 'fa-house';
  if (/servicio|luz|gas|agua|internet|tel/.test(n)) return 'fa-bolt';
  if (/salud|farmacia|m[eé]dico/.test(n)) return 'fa-heart-pulse';
  if (/educa|curso|colegio/.test(n)) return 'fa-graduation-cap';
  if (/ocio|entrete|cine|netflix|spotify/.test(n)) return 'fa-film';
  if (/ropa|indument/.test(n)) return 'fa-shirt';
  if (/tarjeta|cuota/.test(n)) return 'fa-credit-card';
  if (/otro/.test(n)) return 'fa-ellipsis';
  return ICONO_DEFAULT;
}

/** Color estable derivado del nombre, para categorías sin color elegido. */
function colorSugerido(nombre) {
  const texto = String(nombre || '');
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = (hash * 31 + texto.charCodeAt(i)) % 100000;
  }
  return COLORES[hash % COLORES.length];
}

function resolverEstilo({ nombre, icono, color } = {}) {
  return {
    icono: esIconoValido(icono) ? icono : iconoSugerido(nombre),
    color: esColorValido(color) ? color : colorSugerido(nombre),
  };
}

module.exports = {
  ICONOS,
  COLORES,
  ICONO_DEFAULT,
  COLOR_DEFAULT,
  esIconoValido,
  esColorValido,
  iconoSugerido,
  colorSugerido,
  resolverEstilo,
};
