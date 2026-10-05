/**
 * Avocat · Panel de Taller y Confección
 * Gestión privada de pedidos e informes de patronaje
 * Usuario: avomarca · Contraseña: avo1234
 */

(function () {
  const $ = (id) => document.getElementById(id);

  let orders = [];
  let authToken = sessionStorage.getItem('avocat_admin_token') || '';
  let authUser = sessionStorage.getItem('avocat_admin_user') || '';

  const COLOR_GREEN = [31, 74, 34];
  const COLOR_LIGHT = [241, 248, 236];

  /* ------------------- AUTENTICACIÓN ------------------- */
  async function iniciarSesion(user, pass) {
    try {
      const token = btoa(`${user}:${pass}`);
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ action: 'login', user, pass }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { ok: true, token, user };
      }
      return { ok: false, error: data.error || 'Credenciales incorrectas' };
    } catch (e) {
      return { ok: false, error: 'Error de conexión con el servidor' };
    }
  }

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const user = $('userInput').value.trim();
    const pass = $('passInput').value.trim();
    const errBox = $('loginError');
    const btn = $('btnEnter');
    const label = btn.querySelector('.btn-label');
    const loader = btn.querySelector('.btn-loader');

    errBox.style.display = 'none';
    errBox.textContent = '';

    if (!user || !pass) {
      errBox.textContent = 'Por favor completa usuario y contraseña.';
      errBox.style.display = 'block';
      return;
    }

    btn.disabled = true;
    label.textContent = 'Verificando...';
    loader.style.display = 'inline-block';

    const resultado = await iniciarSesion(user, pass);

    btn.disabled = false;
    label.textContent = 'Iniciar Sesión';
    loader.style.display = 'none';

    if (resultado.ok) {
      authToken = resultado.token;
      authUser = resultado.user;
      sessionStorage.setItem('avocat_admin_token', authToken);
      sessionStorage.setItem('avocat_admin_user', authUser);
      mostrarDashboard();
      cargarPedidos();
    } else {
      errBox.textContent = resultado.error;
      errBox.style.display = 'block';
      $('passInput').select();
    }
  });

  function mostrarDashboard() {
    $('authSection').style.display = 'none';
    $('dashboardSection').style.display = 'block';
    $('sessionBar').style.display = 'flex';
    $('sessionUserLabel').textContent = `Usuario: ${authUser || 'avomarca'}`;
  }

  function mostrarLogin() {
    $('authSection').style.display = 'block';
    $('dashboardSection').style.display = 'none';
    $('sessionBar').style.display = 'none';
    $('userInput').value = '';
    $('passInput').value = '';
    $('loginError').style.display = 'none';
    sessionStorage.removeItem('avocat_admin_token');
    sessionStorage.removeItem('avocat_admin_user');
    authToken = '';
    authUser = '';
  }

  $('btnLogout').addEventListener('click', mostrarLogin);

  /* ------------------- CARGA DE DATOS ------------------- */
  async function cargarPedidos() {
    $('syncStatus').textContent = 'Sincronizando...';

    try {
      const res = await fetch('/api/pedidos', {
        headers: {
          'x-admin-token': authToken,
        },
      });

      if (res.status === 401) {
        mostrarLogin();
        const errBox = $('loginError');
        errBox.textContent = 'Sesión expirada. Por favor ingresa de nuevo.';
        errBox.style.display = 'block';
        return;
      }

      const data = await res.json();

      if (data.success && Array.isArray(data.orders)) {
        orders = data.orders;

        $('statOrders').textContent = orders.length;
        const totalPrendas = orders.reduce((sum, o) => sum + (parseInt(o.cantidad, 10) || 1), 0);
        $('statGarments').textContent = totalPrendas;

        if (data.storage) {
          $('statStorage').textContent = data.storage.provider || 'Redis Activo';
          $('statStorage').title = data.storage.status || '';
        }

        $('ordersCountBadge').textContent = orders.length;
        $('btnDownloadBatchPdf').disabled = orders.length === 0;
        $('btnExportCsv').disabled = orders.length === 0;

        const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        $('syncStatus').textContent = `Actualizado a las ${ahora}`;
        renderTabla();
      }
    } catch (err) {
      $('syncStatus').textContent = 'Error al actualizar';
      console.error('Error cargando pedidos:', err);
    }
  }

  $('btnRefresh').addEventListener('click', cargarPedidos);

  /* ------------------- RENDERIZADO DE TABLA ------------------- */
  function renderTabla() {
    const tbody = $('ordersTbody');
    const busqueda = ($('adminSearch').value || '').toLowerCase().trim();
    const filtroTalla = ($('sizeFilter').value || '').trim();

    const filtrados = orders.filter((o) => {
      const coincideTalla = !filtroTalla || o.talla === filtroTalla;
      const coincideBusqueda =
        !busqueda ||
        (o.nombre && o.nombre.toLowerCase().includes(busqueda)) ||
        (o.id && o.id.toLowerCase().includes(busqueda)) ||
        (o.notas && o.notas.toLowerCase().includes(busqueda));
      return coincideTalla && coincideBusqueda;
    });

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty">
            Aún no se han recibido pedidos de clientas en la base de datos.
          </td>
        </tr>
      `;
      return;
    }

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty">
            No se encontraron pedidos con el criterio de búsqueda seleccionado.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtrados
      .map(
        (o) => `
      <tr data-id="${escapeHTML(o.id)}">
        <td>
          <strong>${formatearFechaCorta(o.fecha)}</strong>
          <br><small style="color:var(--mute);">${escapeHTML(o.id)}</small>
        </td>
        <td><strong>${escapeHTML(o.nombre)}</strong></td>
        <td><strong>${o.cantidad}</strong></td>
        <td><span class="tag-size">${escapeHTML(o.talla)}</span></td>
        <td><span class="tag-suggested">${escapeHTML(o.tallaSugerida || '-')}</span></td>
        <td class="measurements-block">
          <span>Pecho:</span> ${o.pecho} cm · <span>Cint:</span> ${o.cintura} cm<br>
          <span>Cadera:</span> ${o.cadera} cm · <span>Homb:</span> ${o.hombros} cm<br>
          <span>Manga:</span> ${o.manga} cm
        </td>
        <td class="notes-text" title="${escapeHTML(o.notas || 'Sin notas especiales')}">
          ${escapeHTML(o.notas || '—')}
        </td>
        <td class="actions-group">
          <button type="button" class="btn-action" data-action="pdf" data-id="${escapeHTML(o.id)}" title="Descargar informe de confección">
            Informe PDF
          </button>
          <button type="button" class="btn-action btn-del" data-action="del" data-id="${escapeHTML(o.id)}" title="Eliminar pedido">
            Eliminar
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  $('adminSearch').addEventListener('input', renderTabla);
  $('sizeFilter').addEventListener('change', renderTabla);

  // Acciones en la tabla
  $('ordersTbody').addEventListener('click', async function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    const order = orders.find((x) => x.id === id);
    if (!order) return;

    if (action === 'pdf') {
      descargarInformeIndividual(order);
      return;
    }

    if (action === 'del') {
      if (!confirm(`¿Confirmas que deseas eliminar el pedido de "${order.nombre}" (${order.id})?`)) {
        return;
      }

      btn.disabled = true;
      try {
        const res = await fetch(`/api/pedidos?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'x-admin-token': authToken,
          },
        });
        const data = await res.json();
        if (data.success) {
          orders = orders.filter((x) => x.id !== id);
          renderTabla();
          $('statOrders').textContent = orders.length;
          const totalPrendas = orders.reduce((sum, o) => sum + (parseInt(o.cantidad, 10) || 1), 0);
          $('statGarments').textContent = totalPrendas;
          $('ordersCountBadge').textContent = orders.length;
        } else {
          alert('Error: ' + (data.error || 'No se pudo eliminar el pedido'));
        }
      } catch (err) {
        alert('Error al comunicarse con el servidor: ' + err.message);
      }
    }
  });

  /* ------------------- GENERADOR DE INFORMES PDF (jsPDF) ------------------- */
  function formatearFecha(isoStr) {
    try {
      return new Date(isoStr).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr || '';
    }
  }

  function formatearFechaCorta(isoStr) {
    try {
      return new Date(isoStr).toLocaleDateString('es-DO', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr || '';
    }
  }

  function agregarCabecera(doc, titulo) {
    try {
      const logoImg = document.querySelector('.logo');
      if (logoImg && logoImg.src) {
        doc.addImage(logoImg.src, 'PNG', 15, 12, 45, 19);
      }
    } catch (e) {
      console.warn('Logo no disponible:', e);
    }

    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(titulo, 195, 23, { align: 'right' });

    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setLineWidth(0.6);
    doc.line(15, 34, 195, 34);
  }

  function generarHojaInforme(doc, o) {
    agregarCabecera(doc, 'Informe de Confeccion');

    const sugerida = o.tallaSugerida || '-';
    const info = [
      ['Cliente / Destinataria', o.nombre],
      ['Fecha de Registro', formatearFecha(o.fecha)],
      ['Prendas a Elaborar', `${o.cantidad} pieza(s)`],
      ['Talla Solicitada por Cliente', o.talla],
      ['Talla Calculada por Medidas', sugerida],
      ['Codigo Unico de Pedido', o.id],
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
    doc.text('Medidas Corporales para Patronaje (cm)', 15, y);
    y += 5;

    const medidas = [
      ['Hombros (ancho de espalda)', o.hombros],
      ['Contorno de Pecho (busto)', o.pecho],
      ['Contorno de Cintura', o.cintura],
      ['Contorno de Cadera', o.cadera],
      ['Largo de Manga', o.manga],
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

    // Notas de Confección
    y += 10;
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Observaciones del Pedido & Taller', 15, y);
    y += 5;

    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setLineWidth(0.3);
    doc.rect(15, y, 180, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 70, 50);
    const notas = o.notas || 'Sin especificaciones adicionales indicadas por el cliente.';
    doc.text(doc.splitTextToSize(notas, 170), 20, y + 8);

    // Checklist de control de taller
    y += 36;
    doc.setFontSize(13);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Control de Calidad en Taller', 15, y);
    y += 5;

    doc.setFillColor(250, 252, 248);
    doc.rect(15, y, 180, 26, 'F');
    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.rect(15, y, 180, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(70, 90, 70);
    doc.text('[  ] Corte de tela verificado     [  ] Armado y prueba inicial     [  ] Acabado y planchado', 20, y + 10);
    doc.text('Sello / Firma de Confeccionista: _________________________       Fecha entrega: ___/___/______', 20, y + 20);

    doc.setFontSize(8.5);
    doc.setTextColor(130, 150, 130);
    doc.text('Avocat Confecciones · Documento Interno de Produccion', 105, 290, { align: 'center' });
  }

  function descargarInformeIndividual(order) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Error: jsPDF no esta cargado.');
      return;
    }
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    generarHojaInforme(doc, order);

    const slug = (order.nombre || 'pedido')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    doc.save(`informe-confeccion-${slug}-${order.id}.pdf`);
  }

  // Descarga del informe general (PDF consolidado)
  $('btnDownloadBatchPdf').addEventListener('click', function () {
    if (!orders.length || !window.jspdf || !window.jspdf.jsPDF) return;

    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });

    // Hoja 1: Resumen Maestro
    agregarCabecera(doc, 'Informe Maestro de Taller');

    const cols = [
      ['#', 15],
      ['Cliente', 24],
      ['Cant.', 84],
      ['Talla', 97],
      ['Suger.', 111],
      ['Pecho', 126],
      ['Cint.', 140],
      ['Cad.', 154],
      ['Homb.', 168],
      ['Manga', 182],
    ];

    function dibujarCabeceraTabla(curY) {
      doc.setFillColor.apply(doc, COLOR_GREEN);
      doc.rect(15, curY - 5.5, 180, 8.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      cols.forEach((c) => doc.text(c[0], c[1], curY));
    }

    let y = 46;
    dibujarCabeceraTabla(y);
    y += 9.5;

    orders.forEach((o, i) => {
      if (y > 270) {
        doc.addPage();
        y = 22;
        dibujarCabeceraTabla(y);
        y += 9.5;
      }
      if (i % 2 === 0) {
        doc.setFillColor.apply(doc, COLOR_LIGHT);
        doc.rect(15, y - 5, 180, 7.5, 'F');
      }
      doc.setTextColor.apply(doc, COLOR_GREEN);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);

      const fila = [
        i + 1,
        (o.nombre || '').slice(0, 26),
        o.cantidad,
        o.talla,
        o.tallaSugerida || '-',
        `${o.pecho}`,
        `${o.cintura}`,
        `${o.cadera}`,
        `${o.hombros}`,
        `${o.manga}`,
      ];

      cols.forEach((c, j) => doc.text(String(fila[j]), c[1], y));
      y += 7.5;
    });

    // Fichas individuales
    orders.forEach((o) => {
      doc.addPage();
      generarHojaInforme(doc, o);
    });

    const totalPaginas = doc.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 140, 120);
      doc.text(`Avocat Confecciones · Pagina ${p} de ${totalPaginas}`, 105, 290, { align: 'center' });
    }

    doc.save(`informe-maestro-taller-${new Date().toISOString().slice(0, 10)}.pdf`);
  });

  /* ------------------- EXPORTAR A EXCEL (CSV) ------------------- */
  $('btnExportCsv').addEventListener('click', function () {
    if (!orders.length) return;

    const cabeceras = [
      'ID Pedido',
      'Fecha',
      'Cliente',
      'Cantidad',
      'Talla Pedida',
      'Talla Sugerida',
      'Pecho (cm)',
      'Cintura (cm)',
      'Cadera (cm)',
      'Hombros (cm)',
      'Largo Manga (cm)',
      'Notas',
    ];

    const filas = orders.map((o) => [
      `"${o.id}"`,
      `"${formatearFecha(o.fecha)}"`,
      `"${(o.nombre || '').replace(/"/g, '""')}"`,
      o.cantidad,
      `"${o.talla}"`,
      `"${o.tallaSugerida || ''}"`,
      o.pecho,
      o.cintura,
      o.cadera,
      o.hombros,
      o.manga,
      `"${(o.notas || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [cabeceras.join(';'), ...filas.map((f) => f.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedidos-avocat-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });

  function escapeHTML(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));
  }

  /* ------------------- INICIALIZACIÓN ------------------- */
  if (authToken && authUser) {
    mostrarDashboard();
    cargarPedidos();
  } else {
    mostrarLogin();
  }
})();
