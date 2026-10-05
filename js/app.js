/**
 * Avocat · Tallas y Medidas
 * Formulario de confección de prendas para clientes
 * Envía y guarda los datos en Vercel Serverless Function (/api/pedidos) con Redis
 */

(function () {
  const $ = (id) => document.getElementById(id);

  // Tablas de tallas para el cálculo sugerido
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const BUST = [84, 89, 94, 99, 106, 999];
  const HIP = [89, 94, 99, 104, 111, 999];

  const ZONES = {
    hombros: 'Hombros (de un hombro al otro, por la espalda)',
    pecho: 'Pecho (alrededor de la parte más ancha)',
    cintura: 'Cintura (alrededor de la parte más estrecha)',
    cadera: 'Cadera (alrededor de la parte más ancha)',
    manga: 'Largo de manga (del hombro a la muñeca)',
  };

  let lastOrder = null;

  /* ------------------- CÁLCULO DE TALLA SUGERIDA ------------------- */
  function getIndex(val, arr) {
    for (let i = 0; i < arr.length; i++) {
      if (val <= arr[i]) return i;
    }
    return arr.length - 1;
  }

  function calcularTallaSugerida(pecho, cadera) {
    return SIZES[Math.max(getIndex(pecho, BUST), getIndex(cadera, HIP))];
  }

  function actualizarSugerencia() {
    const p = parseFloat($('pecho').value);
    const c = parseFloat($('cadera').value);
    const hint = $('hint');

    if (!p || !c) {
      hint.textContent = 'Ingresa pecho y cadera para ver la talla sugerida.';
      hint.classList.remove('suggested');
      return;
    }

    const sugerida = calcularTallaSugerida(p, c);
    hint.innerHTML = `Según tus medidas corporales, tu talla sugerida es <b>${sugerida}</b>.`;
    hint.classList.add('suggested');
  }

  ['pecho', 'cadera'].forEach((id) => {
    $(id).addEventListener('input', actualizarSugerencia);
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
      if (logoImg && logoImg.src) {
        doc.addImage(logoImg.src, 'PNG', 15, 12, 45, 19);
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

  function generarFichaPedido(doc, o) {
    agregarCabeceraPDF(doc, 'Ficha de Medidas');

    const sugerida = o.tallaSugerida || calcularTallaSugerida(o.pecho, o.cadera);
    const info = [
      ['Cliente', o.nombre],
      ['Fecha de pedido', formatearFecha(o.fecha)],
      ['Cantidad de prendas', `${o.cantidad} unidad(es)`],
      ['Talla solicitada', o.talla],
      ['Talla sugerida por medidas', sugerida],
      ['Código de referencia', o.id],
    ];

    let y = 46;
    info.forEach((r, i) => {
      const x = i % 2 ? 112 : 15;
      if (i % 2 === 0 && i > 0) y += 15;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 120, 100);
      doc.text(r[0], x, y);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor.apply(doc, COLOR_GREEN);
      doc.text(String(r[1]), x, y + 5.5);
    });

    y += 24;
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Medidas Corporales (cm)', 15, y);
    y += 5;

    const medidas = [
      ['Hombros (espalda)', o.hombros],
      ['Pecho (busto)', o.pecho],
      ['Cintura', o.cintura],
      ['Cadera', o.cadera],
      ['Largo de manga', o.manga],
    ];

    medidas.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor.apply(doc, COLOR_LIGHT);
        doc.rect(15, y, 180, 10, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor.apply(doc, COLOR_GREEN);
      doc.text(r[0], 20, y + 6.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`${r[1]} cm`, 190, y + 6.8, { align: 'right' });
      y += 10.5;
    });

    y += 10;
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Notas para Confección', 15, y);
    y += 5;

    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setLineWidth(0.3);
    doc.rect(15, y, 180, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 80, 60);
    const notasTexto = o.notas || 'Sin notas especiales especificadas por el cliente.';
    doc.text(doc.splitTextToSize(notasTexto, 170), 20, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 140, 120);
    doc.text('Avocat Confecciones · Tallas y Medidas', 105, 290, { align: 'center' });
  }

  function descargarPDF(order, nombreArchivo) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      $('err').textContent =
        'No se pudo inicializar jsPDF. Por favor recarga la página o verifica tu conexión.';
      return;
    }
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    generarFichaPedido(doc, order);
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

  /* ------------------- ENVÍO A VERCEL SERVERLESS & REDIS ------------------- */
  async function enviarPedidoAPI(datosPedido) {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datosPedido),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al procesar el pedido en el servidor.');
    }
    return data;
  }

  $('guardar').addEventListener('click', async function () {
    const campos = ['nombre', 'cantidad', 'talla', 'pecho', 'cintura', 'cadera', 'hombros', 'manga', 'notas'];
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
    if (!v.talla) {
      err.textContent = 'Por favor selecciona la talla que deseas pedir.';
      $('talla').focus();
      return;
    }

    const medidasClaves = ['pecho', 'cintura', 'cadera', 'hombros', 'manga'];
    const faltantes = medidasClaves.filter((k) => !(+v[k] > 0));
    if (faltantes.length) {
      err.textContent = `Falta completar las siguientes medidas: ${faltantes.join(', ')}.`;
      $(faltantes[0]).focus();
      return;
    }

    const pedidoPayload = {
      nombre: v.nombre,
      cantidad: +v.cantidad,
      talla: v.talla,
      pecho: +v.pecho,
      cintura: +v.cintura,
      cadera: +v.cadera,
      hombros: +v.hombros,
      manga: +v.manga,
      notas: v.notas,
    };

    const btn = $('guardar');
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');

    btn.disabled = true;
    btnText.textContent = 'Guardando pedido...';
    btnSpinner.hidden = false;

    try {
      const respuesta = await enviarPedidoAPI(pedidoPayload);
      lastOrder = respuesta.order;

      $('okt').textContent = '¡Pedido recibido y guardado con éxito!';
      $('okmeta').textContent = `Código: ${lastOrder.id} · Cliente: ${lastOrder.nombre} · Talla solicitada: ${lastOrder.talla} (Sugerida por medidas: ${lastOrder.tallaSugerida})`;
      ok.hidden = false;

      // Limpiar formulario excepto cantidad por defecto
      ['nombre', 'talla', 'pecho', 'cintura', 'cadera', 'hombros', 'manga', 'notas'].forEach((k) => {
        if ($(k)) $(k).value = '';
      });
      $('cantidad').value = 1;
      actualizarSugerencia();
    } catch (e) {
      err.textContent = `No se pudo enviar el pedido: ${e.message}`;
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Enviar mi pedido';
      btnSpinner.hidden = true;
    }
  });

  // Botón para descargar PDF del pedido recién enviado
  $('miPdf').addEventListener('click', function () {
    if (lastOrder) {
      descargarPDF(lastOrder, generarNombreArchivo(lastOrder));
    }
  });

  // Botón para nuevo pedido
  $('nuevoPedidoBtn').addEventListener('click', function () {
    $('ok').hidden = true;
    $('nombre').focus();
  });
})();
