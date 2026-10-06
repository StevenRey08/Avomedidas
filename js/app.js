/**
 * Avocat · Tallas y Medidas
 * Formulario de confección de prendas para clientes
 * Envía y guarda los datos en Vercel Serverless Function (/api/pedidos) con Redis
 */

(function () {
  const $ = (id) => document.getElementById(id);

  // Tablas de tallas para el cálculo sugerido (en pulgadas)
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const BUST = [33, 35, 37, 39, 42, 999];
  const HIP = [35, 37, 39, 41, 44, 999];

  const ZONES = {
    hombros: 'Hombros (de un hombro al otro, por la espalda)',
    pecho: 'Pecho (alrededor de la parte más ancha)',
    cintura: 'Cintura (alrededor de la parte más estrecha)',
    manga: 'Largo de manga (del hombro a la muñeca)',
    cintura_pantalon: 'Cintura Pantalón (contorno para pantalón)',
    largo_pantalon: 'Largo Pantalón (de la cintura al tobillo)',
    hombro_cuello: 'Hombro Cuello (del cuello al hombro)',
    torso: 'Torso (del cuello a la cintura)',
  };

  let lastOrder = null;

  if ($('tipo_prenda')) {
    $('tipo_prenda').addEventListener('change', (e) => {
      const val = e.target.value;
      const showCamisa = val === 'ambos' || val === 'camisa';
      const showPantalon = val === 'ambos' || val === 'pantalon';
      document.querySelectorAll('.group-camisa').forEach(el => el.style.display = showCamisa ? 'block' : 'none');
      document.querySelectorAll('.group-pantalon').forEach(el => el.style.display = showPantalon ? 'block' : 'none');
    });
    setTimeout(() => $('tipo_prenda').dispatchEvent(new Event('change')), 100);
  }

  /* ------------------- CÁLCULO DE TALLA SUGERIDA ------------------- */
  function getIndex(val, arr) {
    for (let i = 0; i < arr.length; i++) {
      if (val <= arr[i]) return i;
    }
    return arr.length - 1;
  }

  function calcularTallaSugerida(pecho, cinturaPantalon) {
    const pIdx = pecho ? getIndex(pecho, BUST) : 0;
    const cIdx = cinturaPantalon ? getIndex(cinturaPantalon, HIP) : 0;
    if (pecho && cinturaPantalon) return { camisa: SIZES[pIdx], pantalon: SIZES[cIdx] };
    if (pecho) return { camisa: SIZES[pIdx] };
    if (cinturaPantalon) return { pantalon: SIZES[cIdx] };
    return {};
  }

  function actualizarSugerencia() {
    const p = parseFloat($('pecho').value);
    const c = parseFloat($('cintura_pantalon').value);
    const hint = $('hint');

    const sug = calcularTallaSugerida(p, c);
    if (!sug.camisa && !sug.pantalon) {
      hint.textContent = 'Ingresa medidas (pecho o cintura pantalón) para ver talla sugerida.';
      hint.classList.remove('suggested');
      return;
    }
    let txt = 'Talla sugerida: ';
    if (sug.camisa) txt += `<b>Camisa ${sug.camisa}</b>. `;
    if (sug.pantalon) txt += `<b>Pantalón ${sug.pantalon}</b>.`;
    hint.innerHTML = txt;
    hint.classList.add('suggested');
  }

  ['pecho', 'cintura_pantalon'].forEach((id) => {
    if ($(id)) $(id).addEventListener('input', actualizarSugerencia);
  });

  /* ------------------- INTERACTIVIDAD DE SILUETA SVG ------------------- */
  function resaltarZona(zonaKey) {
    document.querySelectorAll('.zone').forEach((z) => {
      z.classList.toggle('on', z.getAttribute('data-k') === zonaKey);
    });

    const cap = $('cap');
    if (zonaKey && ZONES[zonaKey]) {
      cap.innerHTML = `Midiendo: <b>${ZONES[zonaKey]}</b>`;
    } else {
      cap.textContent = 'Toca un campo o silueta para ver dónde medir.';
    }
  }

  Object.keys(ZONES).forEach((k) => {
    const input = $(k);
    if (input) {
      input.addEventListener('focus', () => resaltarZona(k));
      input.addEventListener('blur', () => resaltarZona(null));
    }
  });

  document.querySelectorAll('.zone').forEach((zone) => {
    const key = zone.getAttribute('data-k');
    zone.addEventListener('click', () => {
      const input = $(key);
      if (input) input.focus();
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const input = $(key);
        if (input) input.focus();
      }
    });
  });

  /* ------------------- GENERADOR DE FICHA EN PDF (jsPDF) ------------------- */
  const COLOR_GREEN = [31, 74, 34];
  const COLOR_LIGHT = [241, 248, 236];

  function formatearFecha(isoStr) {
    try {
      return new Date(isoStr).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr || '';
    }
  }

  function agregarCabeceraPDF(doc, titulo) {
    try {
      const logoImg = document.querySelector('.logo');
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        doc.addImage(logoImg, 'JPEG', 15, 5, 45, 24);
      }
    } catch (e) {
      console.warn('No se pudo añadir logo al PDF:', e);
    }

    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(titulo, 195, 23, { align: 'right' });

    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setLineWidth(0.6);
    doc.line(15, 34, 195, 34);
  }

  const LOCAL_STORAGE_KEY = 'avocat_pedidos_local';

  function obtenerPedidosLocales() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function guardarEnLocalStorage(order) {
    try {
      const lista = obtenerPedidosLocales();
      const idx = lista.findIndex((x) => x.id === order.id);
      if (idx >= 0) {
        lista[idx] = order;
      } else {
        lista.unshift(order);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista.slice(0, 100)));
    } catch (e) {
      console.warn('No se pudo guardar copia local en localStorage:', e);
    }
  }

  function generarSiluetaCanvas(o) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 460;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 430" width="460" height="540">
        <defs>
          <style>
            .sil-body { fill: #f1f8ec; stroke: #1f4a22; stroke-width: 2.2; stroke-linejoin: round; }
            .m-halo { stroke: #b9e0a5; stroke-width: 7; stroke-linecap: round; }
            .m-line { stroke: #2d6a30; stroke-width: 2.2; stroke-linecap: round; }
            .m-dot { fill: #1f4a22; }
            .g-line { stroke: #4f7351; stroke-width: 1.2; stroke-dasharray: 2,2; }
            .t-bg { fill: #ffffff; stroke: #cfe6c4; stroke-width: 1.2; rx: 4; }
            .t-title { font-family: sans-serif; font-size: 10px; fill: #557957; font-weight: 600; }
            .t-val { font-family: sans-serif; font-size: 13.5px; fill: #1f4a22; font-weight: bold; }
          </style>
        </defs>

        <g transform="translate(60, 10)">
          <circle class="sil-body" cx="100" cy="38" r="22"/>
          <path class="sil-body" d="M92 58h16v16H92z"/>
          <path class="sil-body" d="M54 88Q44 92 44 104L34 200Q34 206 40 206L48 206Q52 204 52 198L62 120Z"/>
          <path class="sil-body" transform="translate(200,0) scale(-1,1)" d="M54 88Q44 92 44 104L34 200Q34 206 40 206L48 206Q52 204 52 198L62 120Z"/>
          <path class="sil-body" d="M92 74L56 86Q50 90 54 100L68 118Q62 138 70 150Q80 170 78 188Q60 215 60 240L68 300L76 352L84 400L97 400L100 268L103 400L116 400L124 352L132 300L140 240Q140 215 122 188Q120 170 130 150Q138 138 132 118L146 100Q150 90 144 86L108 74Z"/>

          <!-- Hombros -->
          <line class="m-halo" x1="54" y1="86" x2="146" y2="86"/>
          <line class="m-line" x1="54" y1="86" x2="146" y2="86"/>
          <circle class="m-dot" cx="54" cy="86" r="3.5"/>
          <circle class="m-dot" cx="146" cy="86" r="3.5"/>

          <!-- Pecho -->
          <line class="m-halo" x1="64" y1="138" x2="136" y2="138"/>
          <line class="m-line" x1="64" y1="138" x2="136" y2="138"/>
          <circle class="m-dot" cx="64" cy="138" r="3.5"/>
          <circle class="m-dot" cx="136" cy="138" r="3.5"/>

          <!-- Cintura -->
          <line class="m-halo" x1="76" y1="186" x2="124" y2="186"/>
          <line class="m-line" x1="76" y1="186" x2="124" y2="186"/>
          <circle class="m-dot" cx="76" cy="186" r="3.5"/>
          <circle class="m-dot" cx="124" cy="186" r="3.5"/>

          <!-- Manga -->
          <line class="m-halo" x1="52" y1="94" x2="41" y2="200"/>
          <line class="m-line" x1="52" y1="94" x2="41" y2="200"/>
          <circle class="m-dot" cx="52" cy="94" r="3.5"/>
          <circle class="m-dot" cx="41" cy="200" r="3.5"/>

          <!-- Medidas Nuevas -->
          ${o.cintura_pantalon ? `
          <line class="m-halo" x1="63" y1="260" x2="137" y2="260"/>
          <line class="m-line" x1="63" y1="260" x2="137" y2="260"/>
          <circle class="m-dot" cx="63" cy="260" r="3.5"/>
          <circle class="m-dot" cx="137" cy="260" r="3.5"/>` : ''}
          ${o.largo_pantalon ? `
          <line class="m-halo" x1="84" y1="186" x2="84" y2="380"/>
          <line class="m-line" x1="84" y1="186" x2="84" y2="380"/>
          <circle class="m-dot" cx="84" cy="186" r="3.5"/>
          <circle class="m-dot" cx="84" cy="380" r="3.5"/>` : ''}
          ${o.hombro_cuello ? `
          <line class="m-halo" x1="90" y1="74" x2="60" y2="86"/>
          <line class="m-line" x1="90" y1="74" x2="60" y2="86"/>
          <circle class="m-dot" cx="90" cy="74" r="3.5"/>
          <circle class="m-dot" cx="60" cy="86" r="3.5"/>` : ''}
          ${o.torso ? `
          <line class="m-halo" x1="100" y1="74" x2="100" y2="186"/>
          <line class="m-line" x1="100" y1="74" x2="100" y2="186"/>
          <circle class="m-dot" cx="100" cy="74" r="3.5"/>
          <circle class="m-dot" cx="100" cy="186" r="3.5"/>` : ''}
        </g>

        <!-- Etiquetas de medidas en la silueta -->
        <line class="g-line" x1="114" y1="96" x2="72" y2="76"/>
        <rect class="t-bg" x="2" y="58" width="70" height="34"/>
        <text class="t-title" x="7" y="71">HOMBROS</text>
        <text class="t-val" x="7" y="86">${o.hombros} in</text>

        <line class="g-line" x1="196" y1="148" x2="245" y2="148"/>
        <rect class="t-bg" x="245" y="131" width="72" height="34"/>
        <text class="t-title" x="250" y="144">PECHO</text>
        <text class="t-val" x="250" y="159">${o.pecho} in</text>

        <line class="g-line" x1="136" y1="196" x2="72" y2="196"/>
        <rect class="t-bg" x="2" y="179" width="70" height="34"/>
        <text class="t-title" x="7" y="192">CINTURA</text>
        <text class="t-val" x="7" y="207">${o.cintura} in</text>

        <line class="g-line" x1="101" y1="160" x2="72" y2="260"/>
        <rect class="t-bg" x="2" y="243" width="70" height="34"/>
        <text class="t-title" x="7" y="256">L. MANGA</text>
        <text class="t-val" x="7" y="271">${o.manga} in</text>

        <!-- Etiquetas Nuevas -->
        ${o.cintura_pantalon ? `
        <line class="g-line" x1="200" y1="270" x2="245" y2="270"/>
        <rect class="t-bg" x="245" y="253" width="72" height="34"/>
        <text class="t-title" x="250" y="266">CINT. PANT</text>
        <text class="t-val" x="250" y="281">${o.cintura_pantalon} in</text>` : ''}
        
        ${o.largo_pantalon ? `
        <line class="g-line" x1="84" y1="280" x2="72" y2="300"/>
        <rect class="t-bg" x="2" y="283" width="70" height="34"/>
        <text class="t-title" x="7" y="296">L. PANT</text>
        <text class="t-val" x="7" y="311">${o.largo_pantalon} in</text>` : ''}

        ${o.hombro_cuello ? `
        <line class="g-line" x1="75" y1="80" x2="40" y2="40"/>
        <rect class="t-bg" x="2" y="23" width="70" height="34"/>
        <text class="t-title" x="7" y="36">HOMB. CUE</text>
        <text class="t-val" x="7" y="51">${o.hombro_cuello} in</text>` : ''}

        ${o.torso ? `
        <line class="g-line" x1="100" y1="130" x2="150" y2="100"/>
        <rect class="t-bg" x="150" y="83" width="70" height="34"/>
        <text class="t-title" x="155" y="96">TORSO</text>
        <text class="t-val" x="155" y="111">${o.torso} in</text>` : ''}
      </svg>
      `;

      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const timeout = setTimeout(() => {
        URL.revokeObjectURL(blobURL);
        resolve(null);
      }, 2500);

      img.onload = function () {
        clearTimeout(timeout);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobURL);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = function () {
        clearTimeout(timeout);
        URL.revokeObjectURL(blobURL);
        resolve(null);
      };
      img.src = blobURL;
    });
  }

  function prepararCanvasImagen(dataUrl, maxW = 900, maxH = 900) {
    return new Promise((resolve) => {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
        return resolve(null);
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.naturalWidth || img.width || 400;
          let h = img.naturalHeight || img.height || 400;
          if (w > maxW || h > maxH) {
            const scale = Math.min(maxW / w, maxH / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ canvas, width: w, height: h });
        } catch (err) {
          console.warn('Error dibujando canvas de imagen para PDF:', err);
          resolve(null);
        }
      };
      img.onerror = (err) => {
        console.warn('Error cargando Image desde dataUrl:', err);
        resolve(null);
      };
      img.src = dataUrl;
    });
  }

  // --- DIBUJADO DE TARJETA DE FOTOGRAFÍA EN PDF (ALTA COSTURA) ---
  function dibujarTarjetaFotoPDF(doc, item, x, y, w, h, titulo) {
    if (!item || !item.canvas) return;

    // Contenedor principal con fondo suave y borde sutil
    doc.setFillColor(249, 252, 247);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
    doc.setDrawColor(31, 74, 34);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'D');

    // Banda superior verde esmeralda para el título
    const headerH = 6.8;
    doc.setFillColor(31, 74, 34);
    doc.roundedRect(x, y, w, headerH, 2.5, 2.5, 'F');
    doc.rect(x, y + headerH - 2.5, w, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, x + w / 2, y + 4.8, { align: 'center' });

    // Área interna para la imagen con preservación exacta de aspecto
    const pad = 2.5;
    const viewX = x + pad;
    const viewY = y + headerH + pad;
    const viewW = w - pad * 2;
    const viewH = h - headerH - pad * 2;

    // Fondo blanco del visor de imagen
    doc.setFillColor(255, 255, 255);
    doc.rect(viewX, viewY, viewW, viewH, 'F');
    doc.setDrawColor(210, 226, 208);
    doc.setLineWidth(0.2);
    doc.rect(viewX, viewY, viewW, viewH, 'D');

    // Cálculo proporcional de escala
    const scale = Math.min(viewW / item.width, viewH / item.height);
    const drawW = item.width * scale;
    const drawH = item.height * scale;
    const drawX = viewX + (viewW - drawW) / 2;
    const drawY = viewY + (viewH - drawH) / 2;

    try {
      doc.addImage(item.canvas, 'JPEG', drawX, drawY, drawW, drawH);
    } catch (e) {
      try {
        doc.addImage(item.canvas.toDataURL('image/jpeg', 0.88), 'JPEG', drawX, drawY, drawW, drawH);
      } catch (err) {
        console.warn('Error insertando imagen en PDF:', err);
      }
    }
  }

  function formatearFechaPDF(isoStr) {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const dia = d.getDate();
      const mes = meses[d.getMonth()];
      const anio = d.getFullYear();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'p. m.' : 'a. m.';
      h = h % 12 || 12;
      return `${dia} ${mes} ${anio} · ${h}:${m} ${ampm}`;
    } catch {
      return isoStr;
    }
  }

  async function generarFichaPedido(doc, o) {
    // 1. CABECERA ELEGANTE (y = 8 a 30)
    try {
      const logoImg = document.querySelector('.logo');
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        doc.addImage(logoImg, 'JPEG', 14, 8, 38, 20);
      }
    } catch (e) {
      console.warn('Logo no disponible:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(79, 115, 81);
    doc.text('AVOCAT POUR LES HOMMES · ATELIER', 196, 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(31, 74, 34);
    doc.text('FICHA TECNICA DE MEDIDAS', 196, 21.5, { align: 'right' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 125, 100);
    doc.text('Taller de Alta Costura & Patronaje a Medida', 196, 26.5, { align: 'right' });

    // Barra esmeralda
    doc.setFillColor(31, 74, 34);
    doc.rect(14, 29.5, 182, 1, 'F');

    // 2. RESUMEN DEL CLIENTE (y = 32 a 57, h = 25mm con espaciado amplio y división)
    const sugerida = o.tallaSugerida || (typeof calcularTallaSugerida === 'function' ? calcularTallaSugerida(o.pecho, o.cintura_pantalon) : '-');
    const tipoPrendaTexto = (o.tipo_prenda === 'camisa') ? 'Solo Camisa' : (o.tipo_prenda === 'pantalon' ? 'Solo Pantalon' : 'Camisa y Pantalon');
    const tallaCliente = [o.talla ? `Camisa: ${o.talla}` : '', o.talla_pantalon ? `Pant: ${o.talla_pantalon}` : ''].filter(Boolean).join(' · ') || (o.talla || 'N/A');

    doc.setFillColor(248, 251, 246);
    doc.roundedRect(14, 32, 182, 25, 2.5, 2.5, 'F');
    doc.setDrawColor(207, 224, 203);
    doc.setLineWidth(0.35);
    doc.roundedRect(14, 32, 182, 25, 2.5, 2.5, 'D');

    // Línea sutil de división entre Fila 1 y Fila 2 para que nunca se vea amontonado
    doc.setDrawColor(225, 238, 222);
    doc.setLineWidth(0.2);
    doc.line(17, 44.5, 193, 44.5);

    // --- Fila 1 de datos ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(79, 115, 81);
    doc.text('CLIENTE / DESTINATARIA:', 18, 36.8);
    doc.text('TALLA SOLICITADA:', 76, 36.8);
    doc.text('FECHA DE REGISTRO:', 136, 36.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 74, 34);
    doc.text(String(o.nombre || 'Cliente').substring(0, 32), 18, 41.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 74, 34);
    doc.text(tallaCliente, 76, 41.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(60, 80, 60);
    doc.text(formatearFechaPDF(o.fecha), 136, 41.8);

    // --- Fila 2 de datos ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(79, 115, 81);
    doc.text('PRENDAS A ELABORAR:', 18, 49);
    doc.text('TALLA SUGERIDA:', 76, 49);
    doc.text('CODIGO UNICO DE PEDIDO:', 136, 49);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(40, 55, 40);
    doc.text(`${o.cantidad || 1} unid. (${tipoPrendaTexto})`, 18, 54);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 74, 34);
    doc.text(String(sugerida), 76, 54);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(79, 115, 81);
    doc.text(String(o.id || 'N/A'), 136, 54);

    // 3. SECCIÓN MEDIA: SILUETA (Izquierda) + TABLA Y NOTAS (Derecha) (y = 61 a 153)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 74, 34);
    doc.text('SILUETA CON PUNTOS DE MEDIDA', 14, 61.2);
    doc.text('TABLA DE MEDIDAS CORPORALES (PULGADAS)', 98, 61.2);

    // Silueta a la izquierda
    const siluetaY = 64;
    const siluetaW = 80;
    const siluetaH = 89;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, siluetaY, siluetaW, siluetaH, 2, 2, 'F');
    doc.setDrawColor(31, 74, 34);
    doc.setLineWidth(0.35);
    doc.roundedRect(14, siluetaY, siluetaW, siluetaH, 2, 2, 'D');

    const siluetaDataUrl = await generarSiluetaCanvas(o);
    if (siluetaDataUrl) {
      doc.addImage(siluetaDataUrl, 'PNG', 15, siluetaY + 1, siluetaW - 2, siluetaH - 2);
    }

    // Tabla de medidas a la derecha (y = 64 a 108)
    let yTable = siluetaY;
    const tableW = 98;
    const medidas = [];
    if (o.hombros) medidas.push(['Hombros (espalda)', `${o.hombros} in`]);
    if (o.pecho) medidas.push(['Pecho (contorno busto)', `${o.pecho} in`]);
    if (o.cintura) medidas.push(['Cintura (contorno)', `${o.cintura} in`]);
    if (o.manga) medidas.push(['Largo de Manga', `${o.manga} in`]);
    if (o.cintura_pantalon) medidas.push(['Cintura Pantalon', `${o.cintura_pantalon} in`]);
    if (o.largo_pantalon) medidas.push(['Largo Pantalon', `${o.largo_pantalon} in`]);
    if (o.hombro_cuello) medidas.push(['Hombro Cuello', `${o.hombro_cuello} in`]);
    if (o.torso) medidas.push(['Torso (Cuello a Cint.)', `${o.torso} in`]);

    const rowH = 5.5;
    medidas.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(243, 247, 239);
        doc.rect(98, yTable, tableW, rowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(60, 85, 60);
      doc.text(r[0], 101, yTable + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(31, 74, 34);
      doc.text(r[1], 193, yTable + 4, { align: 'right' });
      yTable += rowH;
    });

    // Observaciones para confección (y = 111 a 134)
    const yObs = 111;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(79, 115, 81);
    doc.text('OBSERVACIONES PARA CONFECCION', 98, yObs);

    doc.setFillColor(252, 254, 250);
    doc.roundedRect(98, yObs + 2.5, tableW, 21, 1.5, 1.5, 'F');
    doc.setDrawColor(207, 224, 203);
    doc.setLineWidth(0.3);
    doc.roundedRect(98, yObs + 2.5, tableW, 21, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 70, 50);
    const notasTexto = o.notas ? String(o.notas) : 'Sin especificaciones adicionales indicadas por el cliente.';
    doc.text(doc.splitTextToSize(notasTexto, 92), 101, yObs + 7);

    // Caja para Tipo de Tela (y = 137.5 a 153)
    const yTela = 137.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(98, yTela, tableW, 15.5, 1.5, 1.5, 'F');
    doc.setDrawColor(31, 74, 34);
    doc.setLineWidth(0.3);
    doc.roundedRect(98, yTela, tableW, 15.5, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(31, 74, 34);
    doc.text('TIPO DE TELA / REGISTRO DE TALLER:', 101, yTela + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(110, 135, 110);
    doc.text('Tejido seleccionado: _____________________________________________', 101, yTela + 11);

    // 4. SECCIÓN DE FOTOGRAFÍAS (y = 157 a 226)
    const yFotos = 157;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 74, 34);
    doc.text('FOTOGRAFIAS DE REFERENCIA', 14, yFotos + 1.5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 125, 100);
    doc.text('(Cliente y Muestra de Tejido)', 196, yFotos + 1.5, { align: 'right' });

    const fotoClienteObj = await prepararCanvasImagen(o.foto_cliente);
    const fotoTelaObj = await prepararCanvasImagen(o.foto_tela);
    const cardY = yFotos + 4;
    const cardH = 65;

    if (fotoClienteObj && fotoTelaObj) {
      const cardW = 88;
      const gap = 6;
      dibujarTarjetaFotoPDF(doc, fotoClienteObj, 14, cardY, cardW, cardH, 'FOTO DEL CLIENTE · POSTURA DE REFERENCIA');
      dibujarTarjetaFotoPDF(doc, fotoTelaObj, 14 + cardW + gap, cardY, cardW, cardH, 'MUESTRA DE TELA · COLOR Y TEXTURA');
    } else if (fotoClienteObj || fotoTelaObj) {
      const item = fotoClienteObj || fotoTelaObj;
      const titulo = fotoClienteObj ? 'FOTO DEL CLIENTE · POSTURA DE REFERENCIA' : 'MUESTRA DE TELA · COLOR Y TEXTURA';
      const cardW = 110;
      const startX = 14 + (182 - cardW) / 2;
      dibujarTarjetaFotoPDF(doc, item, startX, cardY, cardW, cardH, titulo);
    } else {
      doc.setFillColor(250, 252, 248);
      doc.roundedRect(14, cardY, 182, 18, 2, 2, 'F');
      doc.setDrawColor(215, 230, 212);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, cardY, 182, 18, 2, 2, 'D');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110, 135, 110);
      doc.text('Sin fotografias adjuntas para este pedido · Registro tecnico estandar de taller', 105, cardY + 10.5, { align: 'center' });
    }

    // 5. CONTROL DE CALIDAD EN TALLER (y = 230 a 264.5)
    const yControl = 230;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(31, 74, 34);
    doc.text('CONTROL DE CALIDAD EN TALLER', 14, yControl + 1.5);

    doc.setFillColor(252, 254, 250);
    doc.roundedRect(14, yControl + 4, 182, 30.5, 2, 2, 'F');
    doc.setDrawColor(31, 74, 34);
    doc.setLineWidth(0.35);
    doc.roundedRect(14, yControl + 4, 182, 30.5, 2, 2, 'D');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(50, 70, 50);
    doc.text('[  ] 1. Patron y medidas verificadas', 20, yControl + 12);
    doc.text('[  ] 2. Corte de tela y entretelas', 110, yControl + 12);

    doc.text('[  ] 3. Confeccion y prueba de calce', 20, yControl + 19);
    doc.text('[  ] 4. Acabado, planchado y empaque', 110, yControl + 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(31, 74, 34);
    doc.text('Firma de Confeccionista: _______________________________', 20, yControl + 28.5);
    doc.text('Fecha de Entrega: _____ / _____ / 202___', 118, yControl + 28.5);

    // 6. PIE DE PÁGINA (y = 281.5 a 286)
    doc.setDrawColor(210, 226, 208);
    doc.setLineWidth(0.25);
    doc.line(14, 281.5, 196, 281.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 145, 120);
    doc.text('Avocat Confecciones · Ficha Tecnica Oficial de Taller · Sistema Digital de Confeccion y Medidas', 105, 286, { align: 'center' });
  }

  async function descargarPDF(order, nombreArchivo) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      $('err').textContent =
        'No se pudo inicializar jsPDF. Por favor recarga la página o verifica tu conexión.';
      return;
    }
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    await generarFichaPedido(doc, order);
    doc.save(nombreArchivo);
  }

  function generarNombreArchivo(o) {
    const slug = (o.nombre || 'pedido')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `pedido-avocat-${slug}.pdf`;
  }

  const CLOUD_API_URL = 'https://avomedidas.vercel.app';

  function getApiBase() {
    if (window.location.hostname.endsWith('vercel.app') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '';
    }
    return CLOUD_API_URL;
  }

  const API_BASE = getApiBase();

  /* ------------------- SINCRONIZACIÓN DE PEDIDOS PENDIENTES ------------------- */
  async function sincronizarPedidosPendientes() {
    try {
      const locales = obtenerPedidosLocales();
      if (!locales || locales.length === 0) return;

      for (let i = 0; i < locales.length; i++) {
        const p = locales[i];
        if (!p._sincronizado) {
          try {
            const res = await fetch(`${API_BASE}/api/pedidos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(p),
            });
            if (res.ok) {
              p._sincronizado = true;
            }
          } catch {}
        }
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(locales));
    } catch {}
  }

  // Sincronizar en arranque y al recuperar conexión
  if (typeof window !== 'undefined') {
    window.addEventListener('load', sincronizarPedidosPendientes);
    window.addEventListener('online', sincronizarPedidosPendientes);
  }

  /* ------------------- ENVÍO A VERCEL SERVERLESS & REDIS ------------------- */
  async function enviarPedidoAPI(datosPedido) {
    let res = null;
    let text = '';
    let networkError = null;

    try {
      res = await fetch(`${API_BASE}/api/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosPedido),
      });

      text = await res.text();
    } catch (netErr) {
      console.warn('Servidor backend no disponible en este momento:', netErr);
      networkError = netErr;
    }

    // Si la llamada HTTP funcionó correctamente
    if (res && res.ok) {
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (jsonErr) {
        throw new Error(`Respuesta no válida del servidor (${res.status}): ${text.slice(0, 100)}`);
      }

      if (data.success) {
        const orderGuardado = data.order || datosPedido;
        orderGuardado._sincronizado = true;
        guardarEnLocalStorage(orderGuardado);
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('avocat_pedidos_channel');
            bc.postMessage({ type: 'NUEVO_PEDIDO', order: orderGuardado });
            bc.close();
          }
        } catch {}
        return data;
      }
      throw new Error(data.error || 'Error al procesar el pedido en el servidor.');
    }

    // Si el servidor devolvió un error de validación de campos (400)
    if (res && res.status === 400) {
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}
      throw new Error(data.error || 'Datos del pedido incompletos o inválidos.');
    }

    // Si el servidor está apagado o no responde en este momento:
    // Guardar copia de seguridad en disco local de la máquina del cliente
    const uniqueId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const pedidoConId = {
      ...datosPedido,
      id: uniqueId,
      fecha: new Date().toISOString(),
      tallaSugerida: (() => {
        const sug = calcularTallaSugerida(datosPedido.pecho, datosPedido.cintura_pantalon);
        let s = [];
        if (sug.camisa) s.push(`Camisa ${sug.camisa}`);
        if (sug.pantalon) s.push(`Pantalón ${sug.pantalon}`);
        return s.join(' / ');
      })(),
      _sincronizado: false,
    };

    guardarEnLocalStorage(pedidoConId);

    return {
      success: true,
      order: pedidoConId,
      provider: 'local-backup',
      message: 'Pedido guardado en esta máquina (se sincronizará en cuanto el servidor esté activo).',
    };
  }

  function resizeImage(file, maxDist) {
    return new Promise((resolve) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxDist || h > maxDist) {
            if (w > h) { h = Math.round((h * maxDist) / w); w = maxDist; }
            else { w = Math.round((w * maxDist) / h); h = maxDist; }
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  $('guardar').addEventListener('click', async function () {
    const campos = ['nombre', 'cantidad', 'tipo_prenda', 'talla', 'talla_pantalon', 'pecho', 'cintura', 'hombros', 'manga', 'cintura_pantalon', 'largo_pantalon', 'hombro_cuello', 'torso', 'notas'];
    const v = {};
    campos.forEach((k) => {
      const el = $(k);
      v[k] = el ? el.value.trim() : '';
    });

    const err = $('err');
    const msg = $('msg');
    const ok = $('ok');

    err.textContent = '';
    msg.textContent = '';
    ok.hidden = true;

    // Validaciones de cliente
    if (!v.nombre) {
      err.textContent = 'Por favor escribe tu nombre completo.';
      $('nombre').focus();
      return;
    }
    if (!(+v.cantidad >= 1)) {
      err.textContent = 'La cantidad de prendas debe ser 1 o más.';
      $('cantidad').focus();
      return;
    }
    
    const tp = v.tipo_prenda || 'ambos';
    const isCamisa = tp === 'ambos' || tp === 'camisa';
    const isPantalon = tp === 'ambos' || tp === 'pantalon';

    if (isCamisa && !v.talla) {
      err.textContent = 'Por favor selecciona la talla de camisa.';
      if($('talla')) $('talla').focus();
      return;
    }
    if (isPantalon && !v.talla_pantalon) {
      err.textContent = 'Por favor selecciona la talla de pantalón.';
      if($('talla_pantalon')) $('talla_pantalon').focus();
      return;
    }

    const medidasClaves = [];
    if (isCamisa) medidasClaves.push('pecho', 'cintura', 'hombros', 'manga');
    if (isPantalon) medidasClaves.push('cintura_pantalon', 'largo_pantalon');

    const faltantes = medidasClaves.filter((k) => !(+v[k] > 0));
    if (faltantes.length) {
      err.textContent = `Falta completar las siguientes medidas: ${faltantes.join(', ')}.`;
      if($(faltantes[0])) $(faltantes[0]).focus();
      return;
    }

    const btn = $('guardar');
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = $('btnSpinner') || btn.querySelector('.btn-spinner');

    btn.disabled = true;
    btnText.textContent = 'Procesando imágenes...';
    if (btnSpinner) {
      btnSpinner.classList.add('is-loading');
      btnSpinner.style.display = 'inline-block';
    }

    let foto_cliente = null;
    let foto_tela = null;
    try {
      const fileCliente = $('foto_cliente') ? $('foto_cliente').files[0] : null;
      const fileTela = $('foto_tela') ? $('foto_tela').files[0] : null;
      foto_cliente = await resizeImage(fileCliente, 600);
      foto_tela = await resizeImage(fileTela, 600);
    } catch (e) {
      console.warn('Error al procesar imágenes', e);
    }

    const pedidoPayload = {
      nombre: v.nombre,
      cantidad: +v.cantidad,
      tipo_prenda: tp,
      talla: v.talla || null,
      talla_pantalon: v.talla_pantalon || null,
      pecho: v.pecho ? +v.pecho : null,
      cintura: v.cintura ? +v.cintura : null,
      hombros: v.hombros ? +v.hombros : null,
      manga: v.manga ? +v.manga : null,
      cintura_pantalon: v.cintura_pantalon ? +v.cintura_pantalon : null,
      largo_pantalon: v.largo_pantalon ? +v.largo_pantalon : null,
      hombro_cuello: v.hombro_cuello ? +v.hombro_cuello : null,
      torso: v.torso ? +v.torso : null,
      notas: v.notas,
      foto_cliente,
      foto_tela
    };

    btnText.textContent = 'Guardando pedido...';

    try {
      const respuesta = await enviarPedidoAPI(pedidoPayload);
      lastOrder = respuesta.order;
      
      // PARCHE: Asegurar que las imágenes existan en el PDF aunque la base de datos sea vieja y no las retorne
      if (foto_cliente && !lastOrder.foto_cliente) lastOrder.foto_cliente = foto_cliente;
      if (foto_tela && !lastOrder.foto_tela) lastOrder.foto_tela = foto_tela;

      $('okt').textContent = 'Pedido recibido y guardado con éxito.';
      $('okmeta').textContent = `Código: ${lastOrder.id} · Cliente: ${lastOrder.nombre} · Tipo: ${lastOrder.tipo_prenda}`;
      ok.hidden = false;

      // Limpiar formulario excepto cantidad por defecto
      ['nombre', 'talla', 'talla_pantalon', 'pecho', 'cintura', 'hombros', 'manga', 'cintura_pantalon', 'largo_pantalon', 'hombro_cuello', 'torso', 'notas', 'foto_cliente', 'foto_tela'].forEach((k) => {
        if ($(k)) {
          if ($(k).type === 'file') $(k).value = '';
          else $(k).value = '';
        }
      });
      if (window.__limpiarFotosFormulario) window.__limpiarFotosFormulario();
      $('cantidad').value = 1;
      actualizarSugerencia();
    } catch (e) {
      err.textContent = `No se pudo enviar el pedido: ${e.message}`;
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Enviar mi pedido';
      if (btnSpinner) {
        btnSpinner.classList.remove('is-loading');
        btnSpinner.style.display = 'none';
      }
    }
  });

  // Botón para descargar PDF del pedido recién enviado
  $('miPdf').addEventListener('click', async function () {
    if (lastOrder) {
      const btn = $('miPdf');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Generando PDF con silueta...';
      try {
        await descargarPDF(lastOrder, generarNombreArchivo(lastOrder));
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });

  // Botón para nuevo pedido
  $('nuevoPedidoBtn').addEventListener('click', function () {
    $('ok').hidden = true;
    if (window.__limpiarFotosFormulario) window.__limpiarFotosFormulario();
    $('nombre').focus();
  });

  // --- GESTIÓN INTERACTIVA DE SUBIDA DE FOTOS Y VISTA PREVIA ---
  function configurarSubidaFotos() {
    function vincularFoto(inputId, emptyId, previewId, imgId, triggerId, changeId, removeId) {
      const input = $(inputId);
      const emptyState = $(emptyId);
      const previewState = $(previewId);
      const img = $(imgId);
      const triggerBtn = $(triggerId);
      const changeBtn = $(changeId);
      const removeBtn = $(removeId);
      const card = input ? input.closest('.photo-upload-card') : null;

      if (!input) return null;

      function mostrarImagen(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          if (img) img.src = e.target.result;
          if (emptyState) emptyState.style.display = 'none';
          if (previewState) previewState.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      }

      function limpiarFoto() {
        input.value = '';
        if (img) img.src = '';
        if (previewState) previewState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
      }

      if (triggerBtn) triggerBtn.addEventListener('click', (e) => { e.preventDefault(); input.click(); });
      if (changeBtn) changeBtn.addEventListener('click', (e) => { e.preventDefault(); input.click(); });
      if (removeBtn) removeBtn.addEventListener('click', (e) => { e.preventDefault(); limpiarFoto(); });

      input.addEventListener('change', () => {
        if (input.files && input.files[0]) {
          mostrarImagen(input.files[0]);
        }
      });

      if (card) {
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          card.style.borderColor = 'var(--ink)';
          card.style.background = '#f4f9f0';
        });
        card.addEventListener('dragleave', () => {
          card.style.borderColor = '';
          card.style.background = '';
        });
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          card.style.borderColor = '';
          card.style.background = '';
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
              try {
                input.files = e.dataTransfer.files;
              } catch {}
              mostrarImagen(file);
            }
          }
        });
      }

      return { limpiar: limpiarFoto };
    }

    const c1 = vincularFoto('foto_cliente', 'emptyStateCliente', 'previewStateCliente', 'imgPreviewCliente', 'btnTriggerCliente', 'btnChangeCliente', 'btnRemoveCliente');
    const c2 = vincularFoto('foto_tela', 'emptyStateTela', 'previewStateTela', 'imgPreviewTela', 'btnTriggerTela', 'btnChangeTela', 'btnRemoveTela');

    window.__limpiarFotosFormulario = function () {
      if (c1) c1.limpiar();
      if (c2) c2.limpiar();
    };
  }

  // Inicializar subida de fotos
  configurarSubidaFotos();
})();
