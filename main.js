'use strict';
// Depende de autos.js (CONFIG, PRECIOS_MAX y autos), que se carga antes.

// ========================================
// UTILIDADES
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const formatoCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const formatoNum = new Intl.NumberFormat('es-CO');

const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const comportamiento = sinMovimiento ? 'auto' : 'smooth';

function linkWhatsApp(texto = '') {
  const base = `https://wa.me/${CONFIG.whatsapp}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

function escaparHTML(valor) {
  return String(valor).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function porcentajeDescuento(auto) {
  return auto.original > auto.precio ? Math.round((1 - auto.precio / auto.original) * 100) : 0;
}

// Nombre de archivo esperado para el logo de cada marca en img/marcas/
// (ej. "Mercedes-Benz" -> img/marcas/mercedes-benz.png). Si el archivo no existe,
// se muestra automáticamente un escudo con las iniciales de la marca.
function slugMarca(marca) {
  return marca
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, '-');
}

function inicialesMarca(marca) {
  return marca.split(/[\s-]+/).map(palabra => palabra[0]).slice(0, 2).join('').toUpperCase();
}

function insigniaMarca(marca) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#e9eef4" stroke="#0f233c" stroke-width="2"/>
  <text x="32" y="40" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="21" fill="#0f233c">${inicialesMarca(marca)}</text>
</svg>`);
}

// ========================================
// ESTADO DE LOS FILTROS (una sola fuente de verdad)
const estado = { marcas: new Set(), precioMax: 0, orden: 'precio-desc' };

const ORDENES = {
  'precio-desc': (a, b) => b.precio - a.precio,
  'precio-asc': (a, b) => a.precio - b.precio,
  'descuento': (a, b) => porcentajeDescuento(b) - porcentajeDescuento(a),
  'anio-desc': (a, b) => b.anio - a.anio || a.precio - b.precio,
  'km-asc': (a, b) => a.km - b.km
};

function autosFiltrados() {
  // filter() crea una lista nueva, así que sort() nunca modifica el inventario original
  return autos
    .filter(a => estado.marcas.size === 0 || estado.marcas.has(a.marca))
    .filter(a => !estado.precioMax || a.precio <= estado.precioMax)
    .sort(ORDENES[estado.orden]);
}

// ========================================
// CONTROLES DE FILTRO
function marcasConConteo() {
  const conteo = {};
  autos.forEach(a => { conteo[a.marca] = (conteo[a.marca] || 0) + 1; });
  return Object.entries(conteo).sort(([a], [b]) => a.localeCompare(b, 'es'));
}

function opcionesPrecio(textoTodos) {
  return [`<option value="0">${textoTodos}</option>`]
    .concat(PRECIOS_MAX.map(p => `<option value="${p}">Hasta ${formatoCOP.format(p)}</option>`))
    .join('');
}

function crearControles() {
  const marcas = marcasConConteo();

  // Casillas de marca (barra lateral)
  $('#lista-marcas').innerHTML = marcas.map(([marca, n], i) => `
    <label class="marca" for="marca-${i}">
      <input type="checkbox" id="marca-${i}" value="${escaparHTML(marca)}">
      ${escaparHTML(marca)}
      <span>${n}</span>
    </label>`).join('');

  // Selects del inicio y de la barra lateral
  $('#c-marca').innerHTML = '<option value="">Todas las marcas</option>' +
    marcas.map(([marca]) => `<option value="${escaparHTML(marca)}">${escaparHTML(marca)}</option>`).join('');
  $('#c-precio').innerHTML = opcionesPrecio('Cualquier precio');
  $('#f-precio').innerHTML = opcionesPrecio('Cualquier precio');
}

// Banda superior con las marcas disponibles, deslizándose en bucle continuo
function crearTickerMarcas() {
  const pista = $('#marcas-ticker');
  if (!pista) return;

  const marcas = marcasConConteo().map(([marca]) => marca);
  if (!marcas.length) { pista.hidden = true; return; }

  // Se duplica la lista para que el desplazamiento sea continuo (sin salto al reiniciar)
  const items = [...marcas, ...marcas].map(marca => `
    <button type="button" class="marcas-ticker__item" data-marca="${escaparHTML(marca)}" aria-label="Ver autos ${escaparHTML(marca)}">
      <img class="marcas-ticker__logo" src="img/marcas/${slugMarca(marca)}.png" alt="${escaparHTML(marca)}" width="80" height="80" loading="lazy">
    </button>`).join('');
  pista.innerHTML = items;

  // Si el logo real todavía no existe en img/marcas/, se muestra un escudo con las iniciales
  $$('.marcas-ticker__logo', pista).forEach(img => {
    const marca = img.closest('[data-marca]').dataset.marca;
    img.addEventListener('error', () => { img.src = insigniaMarca(marca); }, { once: true });
  });

  // Tocar una marca filtra el catálogo por esa marca y baja hasta él
  pista.addEventListener('click', e => {
    const boton = e.target.closest('[data-marca]');
    if (!boton) return;
    estado.marcas = new Set([boton.dataset.marca]);
    actualizar();
    $('#autos').scrollIntoView({ behavior: comportamiento, block: 'start' });
  });
}

function sincronizarControles() {
  $$('#lista-marcas input').forEach(cb => { cb.checked = estado.marcas.has(cb.value); });
  $('#f-precio').value = String(estado.precioMax);
  $('#f-orden').value = estado.orden;

  const activos = estado.marcas.size + (estado.precioMax ? 1 : 0);
  $('#filtros-resumen').textContent = activos ? `Filtros (${activos})` : 'Filtros';
  $('#limpiar').hidden = activos === 0;
}

// ========================================
// TARJETAS DE AUTOS
// Un auto puede traer varias fotos en "fotos"; si solo tiene "img", se usa esa
function fotosDe(auto) {
  return Array.isArray(auto.fotos) && auto.fotos.length ? auto.fotos : [auto.img];
}

function plantillaAuto(auto) {
  const fotos = fotosDe(auto);
  const varias = fotos.length > 1;
  const nombre = `${auto.marca} ${auto.modelo} ${auto.anio}`;
  const descuento = porcentajeDescuento(auto);
  const mensaje = `Hola, quiero información del ${nombre} de ${formatoCOP.format(auto.precio)}.`;

  return `
    <article class="auto" data-marca="${escaparHTML(auto.marca)}">
      <div class="auto__foto">
        <div class="auto__galeria${varias ? '' : ' auto__galeria--una'}">
          ${fotos.map((src, i) => `<img class="auto__img" src="${escaparHTML(src)}" alt="${escaparHTML(nombre)}${varias ? `, foto ${i + 1} de ${fotos.length}` : ''}" width="640" height="480" loading="lazy">`).join('')}
        </div>
        ${varias ? `
        <button class="auto__flecha auto__flecha--ant" type="button" data-foto="-1" aria-label="Foto anterior de ${escaparHTML(nombre)}"></button>
        <button class="auto__flecha auto__flecha--sig" type="button" data-foto="1" aria-label="Foto siguiente de ${escaparHTML(nombre)}"></button>
        <span class="auto__contador" aria-hidden="true">1 / ${fotos.length}</span>` : ''}
        ${descuento ? `<span class="auto__cinta">-${descuento}%</span>` : ''}
        <img class="auto__marca" src="img/marcas/${slugMarca(auto.marca)}.png" alt="" width="46" height="46" loading="lazy">
        <ul class="auto__datos">
          <li>${auto.anio}</li>
          <li>${formatoNum.format(auto.km)} km</li>
          <li>Bogotá</li>
        </ul>
      </div>
      <div class="auto__cuerpo">
        <h3 class="auto__nombre"><span>${escaparHTML(auto.marca)}</span> ${escaparHTML(auto.modelo)}</h3>
        <p class="auto__precio">
          ${formatoCOP.format(auto.precio)}
          ${descuento ? `<s><span class="sr-only">Antes </span>${formatoCOP.format(auto.original)}</s>` : ''}
        </p>
        <a class="btn btn--wa btn--bloque" href="${linkWhatsApp(mensaje)}" target="_blank" rel="noopener">
          Preguntar por WhatsApp
        </a>
      </div>
    </article>`;
}

// Galería de fotos de una tarjeta: flechas, deslizar con el dedo y contador
function iniciarGaleria(tarjeta, foto) {
  const galeria = $('.auto__galeria', tarjeta);
  const contador = $('.auto__contador', tarjeta);
  const anterior = $('[data-foto="-1"]', tarjeta);
  const siguiente = $('[data-foto="1"]', tarjeta);

  const actualizar = () => {
    const fotos = $$('.auto__img', galeria);
    if (!fotos.length) { foto.classList.add('auto__foto--sin'); return; }
    if (!contador) return;
    const i = Math.min(fotos.length - 1, Math.round(galeria.scrollLeft / (galeria.clientWidth || 1)));
    contador.textContent = `${i + 1} / ${fotos.length}`;
    anterior.disabled = i === 0;
    siguiente.disabled = i === fotos.length - 1;
    // Con una sola foto que cargó, ya no hace falta navegar
    [anterior, siguiente, contador].forEach(el => { el.hidden = fotos.length < 2; });
  };

  // Si una foto no existe, se quita; si ninguna carga, se muestra el escudo de la marca
  $$('.auto__img', galeria).forEach(img =>
    img.addEventListener('error', () => { img.remove(); actualizar(); }, { once: true })
  );

  if (contador) {
    galeria.addEventListener('scroll', () => requestAnimationFrame(actualizar), { passive: true });
    tarjeta.addEventListener('click', e => {
      const boton = e.target.closest('[data-foto]');
      if (!boton) return;
      galeria.scrollBy({ left: Number(boton.dataset.foto) * galeria.clientWidth, behavior: comportamiento });
    });
    actualizar();
  }
}

function plantillaVacio() {
  return `
    <div class="vacio">
      <p><strong>No hay autos con esos filtros.</strong></p>
      <p>Prueba con otra marca o un presupuesto más alto, o cuéntanos qué buscas y te ayudamos a encontrarlo.</p>
      <div class="vacio__acciones">
        <button class="btn btn--azul" type="button" data-accion="limpiar">Limpiar filtros</button>
        <a class="btn btn--wa" target="_blank" rel="noopener"
           href="${linkWhatsApp('Hola, estoy buscando un carro y no lo encontré en su página.')}">Cuéntanos qué buscas</a>
      </div>
    </div>`;
}

function renderAutos() {
  const lista = autosFiltrados();
  const contenedor = $('#lista-autos');

  contenedor.innerHTML = lista.length ? lista.map(plantillaAuto).join('') : plantillaVacio();
  $('#conteo').textContent = lista.length === autos.length
    ? `${autos.length} ${autos.length === 1 ? 'auto' : 'autos'}`
    : `Mostrando ${lista.length} de ${autos.length} autos`;

  // Si la foto no existe, la tarjeta muestra el escudo de la marca en vez de un ícono roto
  $$('.auto', contenedor).forEach(tarjeta => {
    const foto = $('.auto__foto', tarjeta);
    iniciarGaleria(tarjeta, foto);
    // Si tampoco existe el logo de la marca, se usa el escudo con iniciales
    const logo = $('.auto__marca', tarjeta);
    logo.addEventListener('error', () => { logo.src = insigniaMarca(tarjeta.dataset.marca); }, { once: true });
  });
}

function actualizar() {
  sincronizarControles();
  renderAutos();
}

function limpiarFiltros() {
  estado.marcas.clear();
  estado.precioMax = 0;
  actualizar();
}

// ========================================
// HERO: VIDEO DE FONDO Y ENCABEZADO
function iniciarHero() {
  const hero = $('#inicio');
  const video = $('#hero-video');
  const boton = $('#hero-pausa');
  if (!hero || !video || !boton) return;

  const sinVideo = () => hero.classList.add('hero--sin-video');

  // Si el archivo no existe o la persona ahorra datos, se queda el fondo estático
  const fuentes = $$('source', video);
  fuentes[fuentes.length - 1]?.addEventListener('error', sinVideo);
  video.addEventListener('error', sinVideo);
  // El error puede haber ocurrido antes de poner los oyentes: se revisa también al terminar de cargar
  const revisar = () => { if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) sinVideo(); };
  revisar();
  window.addEventListener('load', revisar);
  if (navigator.connection && navigator.connection.saveData) {
    video.removeAttribute('autoplay');
    video.preload = 'none';
    sinVideo();
    return;
  }

  // Botón de pausa: refleja el estado real del video
  const sincronizar = () => {
    const pausado = video.paused;
    boton.setAttribute('aria-pressed', String(pausado));
    boton.setAttribute('aria-label', pausado ? 'Reproducir el video de fondo' : 'Pausar el video de fondo');
  };
  video.addEventListener('play', sincronizar);
  video.addEventListener('pause', sincronizar);
  boton.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  // Quien pidió menos movimiento ve el video detenido
  if (sinMovimiento) { video.removeAttribute('autoplay'); video.pause(); }
  sincronizar();

  // Ahorra batería: pausa el video cuando el hero ya no se ve
  if ('IntersectionObserver' in window && !sinMovimiento) {
    let pausadoPorScroll = false;
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && !video.paused) { video.pause(); pausadoPorScroll = true; }
      else if (e.isIntersecting && pausadoPorScroll) { video.play().catch(() => {}); pausadoPorScroll = false; }
    }, { threshold: 0.05 }).observe(hero);
  }
}

// El encabezado flota sobre el video y se vuelve sólido al bajar
function iniciarEncabezado() {
  const header = $('.header');
  const marcar = () => header.classList.toggle('header--solido', window.scrollY > 24);
  window.addEventListener('scroll', marcar, { passive: true });
  marcar();
}

// ========================================
// PESTAÑAS DE COMPRAR / VENDER
const TABS = ['comprar', 'vender'];

function activarTab(nombre, enfocar = false) {
  TABS.forEach(n => {
    const activo = n === nombre;
    const tab = $(`#tab-${n}`);
    tab.setAttribute('aria-selected', String(activo));
    tab.tabIndex = activo ? 0 : -1;
    $(`#panel-${n}`).hidden = !activo;
    if (activo && enfocar) tab.focus();
  });
  $$('[data-texto]').forEach(el => { el.hidden = el.dataset.texto !== nombre; });
}

// Lleva a la persona al panel del inicio con la pestaña elegida
function abrirPanel(nombre) {
  activarTab(nombre);
  $('#compra-venta').scrollIntoView({ behavior: comportamiento, block: 'start' });
  const primerCampo = $(`#panel-${nombre} select, #panel-${nombre} input`);
  setTimeout(() => primerCampo && primerCampo.focus({ preventScroll: true }), sinMovimiento ? 0 : 450);
}

function iniciarTabs() {
  TABS.forEach(n => $(`#tab-${n}`).addEventListener('click', () => activarTab(n)));

  // Flechas izquierda/derecha para cambiar de pestaña con el teclado
  $('.tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const actual = TABS.findIndex(n => $(`#tab-${n}`).getAttribute('aria-selected') === 'true');
    const siguiente = e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : (actual + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    activarTab(TABS[siguiente], true);
  });

  // Cualquier enlace con data-abrir="vender" abre el formulario de venta
  $$('[data-abrir]').forEach(enlace =>
    enlace.addEventListener('click', e => {
      e.preventDefault();
      abrirPanel(enlace.dataset.abrir);
    })
  );

  const desdeHash = () => { if (location.hash === '#vender') abrirPanel('vender'); };
  window.addEventListener('hashchange', desdeHash);
  desdeHash();
}

// ========================================
// FORMULARIO: COMPRAR (filtra el inventario)
function iniciarFormularioCompra() {
  $('#form-comprar').addEventListener('submit', e => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const marca = datos.get('marca');

    estado.marcas = marca ? new Set([marca]) : new Set();
    estado.precioMax = Number(datos.get('precio')) || 0;
    actualizar();

    $('#autos').scrollIntoView({ behavior: comportamiento, block: 'start' });
  });
}

// ========================================
// FORMULARIO: VENDER (abre WhatsApp con los datos)
function enviarSolicitud(datos) {
  if (!CONFIG.leadsEndpoint) return;
  const cuerpo = new FormData();
  cuerpo.append('tipo', 'venta');
  Object.entries(datos).forEach(([clave, valor]) => cuerpo.append(clave, valor));
  fetch(CONFIG.leadsEndpoint, { method: 'POST', body: cuerpo, mode: 'no-cors' }).catch(() => {});
}

function iniciarFormularioVenta() {
  const form = $('#form-vender');
  const estadoVenta = $('#venta-estado');
  $('#v-anio').max = new Date().getFullYear() + 1;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    Object.keys(d).forEach(k => { d[k] = String(d[k]).trim(); });

    const precio = Number(d.precio) ? ` Espero recibir ${formatoCOP.format(Number(d.precio))}.` : '';
    const mensaje =
      `Hola, quiero vender mi ${d.marca} ${d.modelo} ${d.anio}, con ${formatoNum.format(Number(d.km))} km.` +
      `${precio} Mi WhatsApp: ${d.whatsapp}.`;
    const url = linkWhatsApp(mensaje);

    window.open(url, '_blank', 'noopener');
    enviarSolicitud(d);

    // Aviso con enlace de respaldo por si el navegador bloqueó la ventana
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.target = '_blank';
    enlace.rel = 'noopener';
    enlace.textContent = 'tócalo aquí';
    estadoVenta.textContent = 'Abrimos WhatsApp con tu solicitud. Si no se abrió, ';
    estadoVenta.append(enlace, '.');
  });
}

// ========================================
// DATOS DE CONTACTO (salen de CONFIG)
function aplicarConfig() {
  $$('[data-wa]').forEach(a => {
    a.href = linkWhatsApp(a.dataset.waText || '');
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-config]').forEach(el => { el.textContent = CONFIG[el.dataset.config]; });
  $$('[data-email]').forEach(a => {
    a.href = `mailto:${CONFIG.email}`;
    a.textContent = CONFIG.email;
  });
  $('#anio-actual').textContent = new Date().getFullYear();
}

// ========================================
// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  aplicarConfig();
  crearControles();
  crearTickerMarcas();
  iniciarHero();
  iniciarEncabezado();
  iniciarTabs();
  iniciarFormularioCompra();
  iniciarFormularioVenta();

  // Filtros de la barra lateral
  $('#lista-marcas').addEventListener('change', () => {
    estado.marcas = new Set($$('#lista-marcas input:checked').map(cb => cb.value));
    actualizar();
  });
  $('#f-precio').addEventListener('change', e => { estado.precioMax = Number(e.target.value); actualizar(); });
  $('#f-orden').addEventListener('change', e => { estado.orden = e.target.value; actualizar(); });
  $('#limpiar').addEventListener('click', limpiarFiltros);
  $('#lista-autos').addEventListener('click', e => {
    if (e.target.closest('[data-accion="limpiar"]')) limpiarFiltros();
  });

  // En pantallas grandes los filtros siempre están abiertos; en el celular se pliegan
  const escritorio = window.matchMedia('(min-width: 900px)');
  const ajustarFiltros = () => { $('#filtros').open = escritorio.matches; };
  escritorio.addEventListener('change', ajustarFiltros);
  ajustarFiltros();

  actualizar();
});
