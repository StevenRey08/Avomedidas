/**
 * Avocat · Panel de Taller y Confección
 * Gestión privada de pedidos e informes de patronaje
 * Usuario: avomarca · Contraseña: avo1234
 */

(function () {
  const $ = (id) => document.getElementById(id);

  let orders = [];
  let authToken = localStorage.getItem('avocat_admin_token') || sessionStorage.getItem('avocat_admin_token') || '';
  let authUser = localStorage.getItem('avocat_admin_user') || sessionStorage.getItem('avocat_admin_user') || '';
  let healthCheckInterval = null;

  const COLOR_GREEN = [31, 74, 34];
  const COLOR_LIGHT = [241, 248, 236];

  const CLOUD_API_URL = 'https://avomedidas.vercel.app';

  function getApiBase() {
    // Si estamos ejecutando directamente dentro de Vercel (mismo dominio en la nube)
    if (window.location.hostname.endsWith('vercel.app')) {
      return '';
    }

    // En cualquier entorno local (acceso directo en escritorio, file://, localhost, Live Server, etc.)
    // SIEMPRE conectarse directamente a la nube de Vercel para recibir los pedidos de los clientes en tiempo real
    return CLOUD_API_URL;
  }

  const API_BASE = getApiBase();
  const LOCAL_STORAGE_KEY = 'avocat_pedidos_local';

  function obtenerPedidosLocales() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function eliminarPedidoLocal(id) {
    try {
      const lista = obtenerPedidosLocales().filter((x) => x.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista));
    } catch (e) {
      console.warn('Error eliminando pedido local:', e);
    }
  }

  /* ------------------- AUTENTICACIÓN ------------------- */
  async function iniciarSesion(user, pass) {
    const credValidas = user === 'avomarca' && pass === 'avo1234';

    try {
      const token = btoa(`${user}:${pass}`);
      const res = await fetch(`${API_BASE}/api/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          'x-admin-user': user,
          'x-admin-pass': pass,
        },
        body: JSON.stringify({ action: 'login', user, pass }),
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (res.ok && data.success) {
        return { ok: true, token, user };
      }

      if (res.status === 401) {
        return { ok: false, error: data.error || 'Usuario o contraseña incorrectos' };
      }

      // Si el servidor devolvió un error inesperado pero las credenciales son las correctas
      if (credValidas) {
        return { ok: true, token, user, offline: true };
      }

      return { ok: false, error: data.error || 'Credenciales incorrectas' };
    } catch (e) {
      console.warn('Servidor no disponible para verificar login, usando validación local:', e);
      // Si el servidor está apagado pero las credenciales coinciden con las del taller:
      if (credValidas) {
        const token = btoa(`${user}:${pass}`);
        return { ok: true, token, user, offline: true };
      }
      return { ok: false, error: 'Usuario o contraseña incorrectos.' };
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
      localStorage.setItem('avocat_admin_token', authToken);
      localStorage.setItem('avocat_admin_user', authUser);
      sessionStorage.setItem('avocat_admin_token', authToken);
      sessionStorage.setItem('avocat_admin_user', authUser);
      mostrarDashboard();
    } else {
      errBox.textContent = resultado.error;
      errBox.style.display = 'block';
      $('passInput').select();
    }
  });

  const POLLING_INTERVAL_ACTIVE = 2500; // Auto-actualización rápida cada 2.5 segundos cuando la ventana está activa
  const POLLING_INTERVAL_HIDDEN = 15000; // 15 segundos cuando la ventana está minimizada
  let autoRefreshTimer = null;
  let pedidosConocidosIds = new Set();
  let recienLlegadosIds = new Set();
  let ultimoFingerprint = '';
  let isFetching = false;
  let toastTimer = null;

  /* ------------------- NOTIFICACIÓN Y CHIME EN TIEMPO REAL ------------------- */
  function reproducirSonidoNuevoPedido() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // Nota 1 (Mi - 659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Nota 2 (Sol# - 830.61Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(830.61, now + 0.12);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {}
  }

  // Desbloquear audio en la primera interacción del usuario con la página
  let audioContextUnlocked = false;
  function desbloquearAudio() {
    if (audioContextUnlocked) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const dummy = new AudioCtx();
        dummy.resume().then(() => {
          dummy.close();
          audioContextUnlocked = true;
        }).catch(() => {});
      }
    } catch {}
  }
  document.addEventListener('click', desbloquearAudio, { once: true });

  function mostrarToastNuevoPedido(order) {
    const toast = $('liveOrderToast');
    if (!toast) return;

    const tallaTxt = order.talla ? ` (${order.talla})` : '';
    $('liveOrderToastTitle').textContent = `¡Nuevo pedido recibido!${tallaTxt}`;
    $('liveOrderToastMsg').textContent = `${order.nombre} · ${order.cantidad} prenda(s)`;
    toast.style.display = 'flex';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 6000);
  }

  function reiniciarTimerPolling() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    if (!authToken) return;

    const ms = document.hidden ? POLLING_INTERVAL_HIDDEN : POLLING_INTERVAL_ACTIVE;
    autoRefreshTimer = setInterval(() => {
      cargarPedidos(true); // Modo silencioso en segundo plano
    }, ms);
  }

  function iniciarAutoActualizacion() {
    detenerAutoActualizacion();
    cargarPedidos(false);
    reiniciarTimerPolling();
  }

  function detenerAutoActualizacion() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function mostrarDashboard() {
    $('authSection').style.display = 'none';
    $('dashboardSection').style.display = 'block';
    $('sessionBar').style.display = 'flex';
    $('sessionUserLabel').textContent = `Usuario: ${authUser || 'avomarca'}`;
    iniciarAutoActualizacion();
  }

  function mostrarLogin() {
    detenerAutoActualizacion();
    $('authSection').style.display = 'block';
    $('dashboardSection').style.display = 'none';
    $('sessionBar').style.display = 'none';
    $('userInput').value = '';
    $('passInput').value = '';
    $('loginError').style.display = 'none';
    localStorage.removeItem('avocat_admin_token');
    localStorage.removeItem('avocat_admin_user');
    sessionStorage.removeItem('avocat_admin_token');
    sessionStorage.removeItem('avocat_admin_user');
    authToken = '';
    authUser = '';
    pedidosConocidosIds.clear();
    recienLlegadosIds.clear();
    ultimoFingerprint = '';
  }

  $('btnLogout').addEventListener('click', mostrarLogin);

  // Auto-actualizar instantáneamente cuando la ventana recupera el foco o se hace visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && authToken) {
      cargarPedidos(true);
    }
    reiniciarTimerPolling();
  });

  window.addEventListener('focus', () => {
    if (authToken) {
      cargarPedidos(true);
    }
  });

  // Comunicación instantánea entre pestañas del mismo navegador (0 milisegundos)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('avocat_pedidos_channel');
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'NUEVO_PEDIDO' && authToken) {
          cargarPedidos(true);
        }
      };
    }
  } catch {}

  // Sincronización cuando cambia el almacenamiento local
  window.addEventListener('storage', (ev) => {
    if (ev.key === LOCAL_STORAGE_KEY && authToken) {
      cargarPedidos(true);
    }
  });

  /* ------------------- CARGA DE DATOS ------------------- */
  async function cargarPedidos(isBackground = false) {
    if (isFetching) return;
    isFetching = true;

    if (!isBackground) {
      $('syncStatus').innerHTML = '<span class="live-dot"></span> Sincronizando...';
      $('syncStatus').classList.remove('is-online', 'is-offline');
      $('syncStatus').setAttribute('role', 'status');
    }

    let serverOrders = [];
    let serverStorage = null;
    let serverOk = false;

    try {
      const res = await fetch(`${API_BASE}/api/pedidos`, {
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

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (data.success && Array.isArray(data.orders)) {
        serverOrders = data.orders;
        serverStorage = data.storage;
        serverOk = true;
      }
    } catch (err) {
      if (!isBackground) {
        console.warn('Servidor no disponible al cargar pedidos:', err);
      }
    } finally {
      isFetching = false;
    }

    // Detectar nuevos pedidos para avisar automáticamente con sonido y toast
    if (serverOk && pedidosConocidosIds.size > 0 && serverOrders.length > 0) {
      const nuevos = serverOrders.filter((o) => !pedidosConocidosIds.has(o.id));
      if (nuevos.length > 0) {
        nuevos.forEach((n) => recienLlegadosIds.add(n.id));
        reproducirSonidoNuevoPedido();
        mostrarToastNuevoPedido(nuevos[0]);
        setTimeout(() => {
          nuevos.forEach((n) => recienLlegadosIds.delete(n.id));
          renderTabla();
        }, 7000);
      }
    }

    // Guardar IDs conocidos
    if (serverOk && serverOrders.length > 0) {
      pedidosConocidosIds = new Set(serverOrders.map((o) => o.id));
    }

    // Manejo de órdenes según estado de servidor y almacenamiento en la nube
    if (serverOk && serverStorage && serverStorage.configured) {
      orders = serverOrders;
    } else if (serverOk && serverOrders.length > 0) {
      orders = serverOrders;
    } else {
      const localOrders = obtenerPedidosLocales();
      orders = localOrders;
    }

    // Ordenar de más reciente a más antiguo
    orders.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    $('statOrders').textContent = orders.length;
    const totalPrendas = orders.reduce((sum, o) => sum + (parseInt(o.cantidad, 10) || 1), 0);
    $('statGarments').textContent = totalPrendas;

    const banner = $('storageAlertBanner');
    if (serverStorage) {
      $('statStorage').textContent = serverStorage.provider || 'Redis Activo';
      $('statStorage').title = serverStorage.status || '';

      if (banner) {
        banner.style.display = serverStorage.configured === false ? 'flex' : 'none';
      }
    } else {
      $('statStorage').textContent = serverOk ? 'Nube Vercel' : 'Modo Desconectado';
      $('statStorage').title = 'Conectado a Vercel Cloud';
      if (banner) banner.style.display = 'none';
    }

    $('ordersCountBadge').textContent = orders.length;
    $('btnDownloadBatchPdf').disabled = orders.length === 0;
    $('btnExportCsv').disabled = orders.length === 0;

    if (serverOk) {
      const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      $('syncStatus').innerHTML = `<span class="live-dot"></span> <b>En vivo</b> · sincronizado ${ahora}`;
      $('syncStatus').classList.add('is-online');
      $('syncStatus').classList.remove('is-offline');
      $('syncStatus').title = 'Auto-actualización automática activa en tiempo real (cada 2.5s)';
    } else {
      $('syncStatus').innerHTML = 'Servidor en la nube desconectado · mostrando datos locales';
      $('syncStatus').classList.add('is-offline');
      $('syncStatus').classList.remove('is-online');
    }

    // Comprobar si cambió la lista de pedidos para evitar re-renderizados innecesarios del DOM
    const nuevoFingerprint = orders.map((o) => `${o.id}:${o.fecha}:${o.cantidad}:${o.talla}`).join('|');
    const cambio = nuevoFingerprint !== ultimoFingerprint;
    ultimoFingerprint = nuevoFingerprint;

    if (cambio || !isBackground) {
      renderTabla();
    }
  }

  $('btnRefresh').addEventListener('click', () => cargarPedidos(false));

  let currentPage = 1;
  let pageSize = 50;

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
      if ($('paginationBar')) $('paginationBar').style.display = 'none';
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
      if ($('paginationBar')) $('paginationBar').style.display = 'none';
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty">
            No se encontraron pedidos con el criterio de búsqueda seleccionado.
          </td>
        </tr>
      `;
      return;
    }

    const totalFiltrados = filtrados.length;
    let itemsAMostrar = filtrados;

    if (pageSize !== 'all') {
      const totalPages = Math.ceil(totalFiltrados / pageSize) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalFiltrados);
      itemsAMostrar = filtrados.slice(startIndex, endIndex);

      if ($('paginationBar')) {
        $('paginationBar').style.display = 'flex';
        $('pageRangeStart').textContent = startIndex + 1;
        $('pageRangeEnd').textContent = endIndex;
        $('pageTotalCount').textContent = totalFiltrados;
        $('pageCurrentLabel').textContent = `Pág. ${currentPage} / ${totalPages}`;
        $('btnPrevPage').disabled = currentPage <= 1;
        $('btnNextPage').disabled = currentPage >= totalPages;
      }
    } else {
      if ($('paginationBar')) {
        $('paginationBar').style.display = 'flex';
        $('pageRangeStart').textContent = 1;
        $('pageRangeEnd').textContent = totalFiltrados;
        $('pageTotalCount').textContent = totalFiltrados;
        $('pageCurrentLabel').textContent = 'Todos';
        $('btnPrevPage').disabled = true;
        $('btnNextPage').disabled = true;
      }
    }

    tbody.innerHTML = itemsAMostrar
      .map((o) => {
        const esNuevo = recienLlegadosIds.has(o.id);
        return `
      <tr data-id="${escapeHTML(o.id)}" class="${esNuevo ? 'row-nuevo-pedido' : ''}">
        <td>
          <strong>${formatearFechaCorta(o.fecha)}</strong>
          ${esNuevo ? '<span class="badge-nuevo-item">¡NUEVO!</span>' : ''}
          <br><small style="color:var(--mute);">${escapeHTML(o.id)}</small>
        </td>
        <td><strong>${escapeHTML(o.nombre)}</strong></td>
        <td><strong>${o.cantidad}</strong></td>
        <td>
          <span class="tag-size">${escapeHTML(o.talla || 'N/A')}</span><br>
          <small>${escapeHTML(o.talla_pantalon || '')}</small>
        </td>
        <td><span class="tag-suggested">${escapeHTML(o.tallaSugerida || '-')}</span></td>
        <td class="measurements-block">
          ${o.pecho ? `<span>Pecho:</span> ${o.pecho}" · <span>Cint:</span> ${o.cintura}"<br><span>Homb:</span> ${o.hombros}" · <span>Manga:</span> ${o.manga}"` : ''}
          ${o.cintura_pantalon || o.largo_pantalon ? `<br><span>C.Pant:</span> ${o.cintura_pantalon||'-'}" · <span>Larg.Pant:</span> ${o.largo_pantalon||'-'}"` : ''}
          ${o.hombro_cuello || o.torso ? `<br><span>H.Cuello:</span> ${o.hombro_cuello||'-'}" · <span>Torso:</span> ${o.torso||'-'}"` : ''}
        </td>
        <td class="notes-text" title="${escapeHTML(o.notas || 'Sin notas especiales')}">
          ${escapeHTML(o.notas || '—')}
          ${(o.foto_cliente || o.foto_tela) ? `
            <div style="display:flex; align-items:center; gap:6px; margin-top:6px; flex-wrap:wrap;">
              ${o.foto_cliente ? `<img src="${o.foto_cliente}" title="Foto del Cliente (clic para ver)" style="width:30px; height:30px; object-fit:cover; border-radius:4px; border:1px solid #1f4a22; cursor:pointer;" onclick="window.verFotoTaller('${escapeHTML(o.foto_cliente)}')">` : ''}
              ${o.foto_tela ? `<img src="${o.foto_tela}" title="Foto de la Tela (clic para ver)" style="width:30px; height:30px; object-fit:cover; border-radius:4px; border:1px solid #1f4a22; cursor:pointer;" onclick="window.verFotoTaller('${escapeHTML(o.foto_tela)}')">` : ''}
              <span style="font-size:10.5px; font-weight:700; color:#1f4a22;">${(o.foto_cliente && o.foto_tela) ? '📸 2 fotos' : '📸 1 foto'}</span>
            </div>
          ` : ''}
        </td>
        <td class="actions-group">
          <button type="button" class="btn-action btn-edit" data-action="edit" data-id="${escapeHTML(o.id)}" title="Editar medidas o datos del pedido">
            Editar
          </button>
          <button type="button" class="btn-action" data-action="pdf" data-id="${escapeHTML(o.id)}" title="Descargar informe de confección con silueta">
            PDF
          </button>
          <button type="button" class="btn-action btn-del" data-action="del" data-id="${escapeHTML(o.id)}" title="Eliminar pedido">
            Eliminar
          </button>
        </td>
      </tr>
    `;
      })
      .join('');
  }

  $('adminSearch').addEventListener('input', () => {
    currentPage = 1;
    renderTabla();
  });

  $('sizeFilter').addEventListener('change', () => {
    currentPage = 1;
    renderTabla();
  });

  if ($('btnPrevPage')) {
    $('btnPrevPage').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTabla();
      }
    });
  }

  if ($('btnNextPage')) {
    $('btnNextPage').addEventListener('click', () => {
      currentPage++;
      renderTabla();
    });
  }

  if ($('pageSizeSelect')) {
    $('pageSizeSelect').addEventListener('change', (e) => {
      pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
      currentPage = 1;
      renderTabla();
    });
  }

  // Acciones en la tabla
  $('ordersTbody').addEventListener('click', async function (e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    const order = orders.find((x) => x.id === id);
    if (!order) return;

    if (action === 'edit') {
      abrirModalEdicion(order);
      return;
    }

    if (action === 'pdf') {
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Generando...';
      try {
        await descargarInformeIndividual(order);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }

    if (action === 'del') {
      if (!confirm(`¿Confirmas que deseas eliminar el pedido de "${order.nombre}" (${order.id})?`)) {
        return;
      }

      btn.disabled = true;
      eliminarPedidoLocal(id);

      try {
        await fetch(`${API_BASE}/api/pedidos?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: {
            'x-admin-token': authToken,
          },
        });
      } catch (err) {
        console.warn('Error eliminando en backend, eliminado localmente:', err);
      }

      orders = orders.filter((x) => x.id !== id);
      renderTabla();
      $('statOrders').textContent = orders.length;
      const totalPrendas = orders.reduce((sum, o) => sum + (parseInt(o.cantidad, 10) || 1), 0);
      $('statGarments').textContent = totalPrendas;
      $('ordersCountBadge').textContent = orders.length;
    }
  });

  /* ------------------- EDICIÓN DE PEDIDOS ------------------- */
  function abrirModalEdicion(order) {
    $('editOrderId').value = order.id || '';
    $('editOrderFecha').value = order.fecha || '';
    $('editNombre').value = order.nombre || '';
    $('editCantidad').value = order.cantidad || 1;
    $('editTipoPrenda').value = order.tipo_prenda || 'ambos';
    $('editTalla').value = order.talla || '';
    $('editTallaPantalon').value = order.talla_pantalon || '';
    $('editPecho').value = order.pecho || '';
    $('editCintura').value = order.cintura || '';
    $('editHombros').value = order.hombros || '';
    $('editManga').value = order.manga || '';
    $('editCinturaPantalon').value = order.cintura_pantalon || '';
    $('editLargoPantalon').value = order.largo_pantalon || '';
    $('editHombroCuello').value = order.hombro_cuello || '';
    $('editTorso').value = order.torso || '';
    $('editNotas').value = order.notas || '';

    $('editFotoCliente').value = '';
    $('editFotoTela').value = '';
    if (order.foto_cliente) {
      $('previewFotoCliente').innerHTML = `<img src="${order.foto_cliente}" style="width:100%; height:auto;" alt="Foto Cliente">`;
    } else {
      $('previewFotoCliente').innerHTML = '';
    }
    
    if (order.foto_tela) {
      $('previewFotoTela').innerHTML = `<img src="${order.foto_tela}" style="width:100%; height:auto;" alt="Foto Tela">`;
    } else {
      $('previewFotoTela').innerHTML = '';
    }

    $('editModal').style.display = 'flex';
    $('editNombre').focus();
  }

  function cerrarModalEdicion() {
    $('editModal').style.display = 'none';
  }

  $('btnCancelEdit').addEventListener('click', cerrarModalEdicion);
  $('btnCancelEdit2').addEventListener('click', cerrarModalEdicion);
  $('editModal').addEventListener('click', (e) => {
    if (e.target === $('editModal')) cerrarModalEdicion();
  });

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

  $('editOrderForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = $('editOrderId').value;
    const fecha = $('editOrderFecha').value || new Date().toISOString();

    let foto_cliente = orders.find((x) => x.id === id)?.foto_cliente || null;
    let foto_tela = orders.find((x) => x.id === id)?.foto_tela || null;
    
    try {
      const fileCliente = $('editFotoCliente').files[0];
      const fileTela = $('editFotoTela').files[0];
      if (fileCliente) foto_cliente = await resizeImage(fileCliente, 600);
      if (fileTela) foto_tela = await resizeImage(fileTela, 600);
    } catch(err) {}

    const payload = {
      id,
      fecha,
      nombre: $('editNombre').value.trim(),
      cantidad: parseInt($('editCantidad').value, 10) || 1,
      tipo_prenda: $('editTipoPrenda').value,
      talla: $('editTalla').value || null,
      talla_pantalon: $('editTallaPantalon').value || null,
      pecho: $('editPecho').value ? parseFloat($('editPecho').value) : null,
      cintura: $('editCintura').value ? parseFloat($('editCintura').value) : null,
      hombros: $('editHombros').value ? parseFloat($('editHombros').value) : null,
      manga: $('editManga').value ? parseFloat($('editManga').value) : null,
      cintura_pantalon: $('editCinturaPantalon').value ? parseFloat($('editCinturaPantalon').value) : null,
      largo_pantalon: $('editLargoPantalon').value ? parseFloat($('editLargoPantalon').value) : null,
      hombro_cuello: $('editHombroCuello').value ? parseFloat($('editHombroCuello').value) : null,
      torso: $('editTorso').value ? parseFloat($('editTorso').value) : null,
      notas: $('editNotas').value.trim(),
      foto_cliente,
      foto_tela
    };

    const btn = $('btnSaveEdit');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const res = await fetch(`${API_BASE}/api/pedidos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': authToken,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (!res.ok) {
        throw new Error(data.error || 'Error del servidor');
      }

      const updatedOrder = data.order || payload;

      // Actualizar en array en memoria
      const idx = orders.findIndex((x) => x.id === id);
      if (idx >= 0) {
        orders[idx] = updatedOrder;
      }

      // Actualizar en localStorage
      try {
        const localList = obtenerPedidosLocales();
        const lIdx = localList.findIndex((x) => x.id === id);
        if (lIdx >= 0) {
          localList[lIdx] = updatedOrder;
        } else {
          localList.unshift(updatedOrder);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localList));
      } catch {}

      renderTabla();
      const totalPrendas = orders.reduce((sum, o) => sum + (parseInt(o.cantidad, 10) || 1), 0);
      $('statGarments').textContent = totalPrendas;
      cerrarModalEdicion();
    } catch (err) {
      alert('No se pudo guardar la modificación: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
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
      if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
        doc.addImage(logoImg, 'JPEG', 15, 5, 45, 24);
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

      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobURL);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = function () {
        URL.revokeObjectURL(blobURL);
        resolve(null);
      };
      img.src = blobURL;
    });
  }

  window.verFotoTaller = function (src) {
    if (!src) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`
        <!DOCTYPE html>
        <html><head><title>Visualizador de Foto · Avocat</title></head>
        <body style="margin:0; background:#0d150e; display:flex; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif;">
          <div style="text-align:center; padding:16px;">
            <img src="${src}" style="max-width:92vw; max-height:88vh; object-fit:contain; border-radius:8px; box-shadow:0 12px 40px rgba(0,0,0,0.8); border:1px solid #2d6a30;">
            <p style="color:#a7f3d0; margin-top:12px; font-size:13px; font-weight:bold;">Avocat Confecciones · Fotografía de Pedido</p>
          </div>
        </body></html>
      `);
      w.document.close();
    }
  };

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

  function dibujarFotoEnPDF(doc, item, x, y, cardW, cardH, titulo, subtitulo) {
    if (!item || !item.canvas) return;

    // Fondo y borde de la tarjeta completa
    doc.setFillColor(252, 254, 250);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F');
    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, cardW, cardH, 3, 3, 'D');

    // Barra superior verde
    doc.setFillColor.apply(doc, COLOR_GREEN);
    doc.roundedRect(x, y, cardW, 8.5, 3, 3, 'F');
    doc.rect(x, y + 4.5, cardW, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, x + cardW / 2, y + 6, { align: 'center' });

    // Dimensiones disponibles para la imagen
    const pad = 4;
    const maxImgW = cardW - (pad * 2);
    const maxImgH = cardH - 18 - (pad * 2);

    const ratio = Math.min(maxImgW / item.width, maxImgH / item.height);
    const drawW = item.width * ratio;
    const drawH = item.height * ratio;
    const drawX = x + pad + (maxImgW - drawW) / 2;
    const drawY = y + 10 + pad + (maxImgH - drawH) / 2;

    // Fondo blanco y borde sutil
    doc.setFillColor(255, 255, 255);
    doc.rect(x + pad, y + 10, maxImgW, maxImgH + pad, 'F');
    doc.setDrawColor(215, 228, 215);
    doc.setLineWidth(0.25);
    doc.rect(x + pad, y + 10, maxImgW, maxImgH + pad, 'D');

    try {
      doc.addImage(item.canvas, 'JPEG', drawX, drawY, drawW, drawH);
    } catch (e) {
      try {
        doc.addImage(item.canvas.toDataURL('image/jpeg', 0.9), 'JPEG', drawX, drawY, drawW, drawH);
      } catch (e2) {
        console.error('Error insertando imagen en PDF:', e2);
      }
    }

    if (subtitulo) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.8);
      doc.setTextColor(80, 105, 80);
      doc.text(subtitulo, x + cardW / 2, y + cardH - 3.5, { align: 'center' });
    }
  }

  async function generarHojaInforme(doc, o) {
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

    let y = 44;
    info.forEach((r, i) => {
      const x = i % 2 ? 112 : 15;
      if (i % 2 === 0 && i > 0) y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 120, 100);
      doc.text(r[0], x, y);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor.apply(doc, COLOR_GREEN);
      doc.text(String(r[1]), x, y + 5);
    });

    // Separador
    y += 18;
    doc.setDrawColor.apply(doc, COLOR_LIGHT);
    doc.setLineWidth(0.4);
    doc.line(15, y, 195, y);
    y += 8;

    // Sección Silueta (Izquierda) + Tabla de Medidas (Derecha)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Silueta con Puntos de Medida', 15, y);
    doc.text('Tabla de Medidas Corporales (pulgadas)', 106, y);
    y += 5;

    // Renderizar imagen de la silueta en canvas y pegarla en el PDF
    const siluetaDataUrl = await generarSiluetaCanvas(o);
    if (siluetaDataUrl) {
      doc.setDrawColor.apply(doc, COLOR_GREEN);
      doc.setLineWidth(0.3);
      doc.rect(15, y, 82, 96);
      doc.addImage(siluetaDataUrl, 'PNG', 16, y + 1, 80, 94);
    }

    // Tabla de Medidas a la derecha
    let yTable = y;
    const medidas = [];
    if (o.hombros) medidas.push(['Hombros (espalda)', `${o.hombros} in`]);
    if (o.pecho) medidas.push(['Pecho (contorno busto)', `${o.pecho} in`]);
    if (o.cintura) medidas.push(['Cintura (contorno)', `${o.cintura} in`]);
    if (o.manga) medidas.push(['Largo de Manga', `${o.manga} in`]);

    if (o.cintura_pantalon) medidas.push(['Cintura Pantalón', `${o.cintura_pantalon} in`]);
    if (o.largo_pantalon) medidas.push(['Largo Pantalón', `${o.largo_pantalon} in`]);
    if (o.hombro_cuello) medidas.push(['Hombro Cuello', `${o.hombro_cuello} in`]);
    if (o.torso) medidas.push(['Torso (Cuello a Cint.)', `${o.torso} in`]);

    medidas.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor.apply(doc, COLOR_LIGHT);
        doc.rect(106, yTable, 89, 9, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor.apply(doc, COLOR_GREEN);
      doc.text(r[0], 110, yTable + 6.2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(r[1], 192, yTable + 6.2, { align: 'right' });
      yTable += 9.5;
    });

    // Observaciones del Pedido a la derecha debajo de la tabla
    yTable += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Observaciones para Confeccion', 106, yTable);
    yTable += 4;

    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setLineWidth(0.3);
    doc.rect(106, yTable, 89, 39);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 80, 60);
    const notas = o.notas || 'Sin especificaciones adicionales indicadas por el cliente.';
    doc.text(doc.splitTextToSize(notas, 83), 110, yTable + 6);

    // Tipo de tela (textbox vacio para escribir a mano)
    let yTela = Math.max(yTable + 39, y + 95) + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Tipo de Tela:', 16, yTela + 5);
    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.setFillColor(250, 252, 248);
    doc.rect(42, yTela, 153, 7, 'FD'); // Box para tipo de tela

    // Control de Taller al pie
    const yControl = yTela + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, COLOR_GREEN);
    doc.text('Control de Calidad en Taller', 15, yControl);

    doc.setFillColor(252, 254, 250);
    doc.rect(15, yControl + 4, 180, 24, 'F');
    doc.setDrawColor.apply(doc, COLOR_GREEN);
    doc.rect(15, yControl + 4, 180, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 80, 60);
    doc.text('[  ] Patron y medidas verificados     [  ] Corte de tela     [  ] Armado y prueba     [  ] Acabado y planchado', 20, yControl + 13);
    doc.text('Firma de Confeccionista: ____________________________        Fecha de entrega: _____ / _____ / _________', 20, yControl + 22);

    // --- PROCESAMIENTO ROBUSTO DE FOTOGRAFÍAS ---
    const fotoClienteObj = await prepararCanvasImagen(o.foto_cliente);
    const fotoTelaObj = await prepararCanvasImagen(o.foto_tela);
    const tieneFotos = Boolean(fotoClienteObj || fotoTelaObj);

    // Sección de fotos inline (misma hoja) ─ tira horizontal compacta debajo del control
    let yFotos = yControl + 32;
    if (tieneFotos) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, COLOR_GREEN);
      doc.text('📸 Fotografías del Pedido', 15, yFotos);

      const FOTO_H = 42;   // altura de cada foto en mm
      const FOTO_W_1 = 83; // ancho cuando hay UNA sola foto
      const FOTO_W_2 = 82; // ancho cuando hay DOS fotos
      const GAP      = 8;  // espacio entre las dos fotos
      yFotos += 3;

      function dibujarTarjetaCompacta(item, tarjX, tarjY, tarjW, etiqueta) {
        if (!item) return;
        // Marco con borde
        doc.setFillColor(252, 254, 250);
        doc.roundedRect(tarjX, tarjY, tarjW, FOTO_H + 9, 2, 2, 'F');
        doc.setDrawColor.apply(doc, COLOR_GREEN);
        doc.setLineWidth(0.3);
        doc.roundedRect(tarjX, tarjY, tarjW, FOTO_H + 9, 2, 2, 'D');
        // Cabecera verde de la tarjeta
        doc.setFillColor.apply(doc, COLOR_GREEN);
        doc.roundedRect(tarjX, tarjY, tarjW, 7, 2, 2, 'F');
        doc.rect(tarjX, tarjY + 3, tarjW, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(etiqueta, tarjX + tarjW / 2, tarjY + 5.2, { align: 'center' });
        // Imagen centrada en la tarjeta
        const pad = 3;
        const imgAreaW = tarjW - pad * 2;
        const imgAreaH = FOTO_H;
        const ratio = Math.min(imgAreaW / item.width, imgAreaH / item.height);
        const dW = item.width * ratio;
        const dH = item.height * ratio;
        const dX = tarjX + pad + (imgAreaW - dW) / 2;
        const dY = tarjY + 7 + (imgAreaH - dH) / 2;
        doc.setFillColor(255, 255, 255);
        doc.rect(tarjX + pad, tarjY + 7, imgAreaW, imgAreaH, 'F');
        try {
          doc.addImage(item.canvas, 'JPEG', dX, dY, dW, dH);
        } catch (e) {
          try { doc.addImage(item.canvas.toDataURL('image/jpeg', 0.85), 'JPEG', dX, dY, dW, dH); } catch {}
        }
      }

      if (fotoClienteObj && fotoTelaObj) {
        dibujarTarjetaCompacta(fotoClienteObj, 15,                  yFotos, FOTO_W_2, 'Foto del Cliente');
        dibujarTarjetaCompacta(fotoTelaObj,    15 + FOTO_W_2 + GAP, yFotos, FOTO_W_2, 'Foto de la Tela');
      } else {
        const startX = 15 + (180 - FOTO_W_1) / 2;
        dibujarTarjetaCompacta(fotoClienteObj || fotoTelaObj, startX, yFotos, FOTO_W_1,
          fotoClienteObj ? 'Foto del Cliente' : 'Foto de la Tela');
      }
    }

    // Pie de página único
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 150, 130);
    doc.text('Avocat Confecciones · Ficha Tecnica Oficial de Taller', 105, 290, { align: 'center' });
  }

  async function descargarInformeIndividual(order) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Error: jsPDF no esta disponible.');
      return;
    }
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    await generarHojaInforme(doc, order);

    const slug = (order.nombre || 'pedido')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    doc.save(`informe-confeccion-${slug}-${order.id}.pdf`);
  }

  // Descarga del informe general (PDF consolidado)
  $('btnDownloadBatchPdf').addEventListener('click', async function () {
    if (!orders.length || !window.jspdf || !window.jspdf.jsPDF) return;

    const btn = $('btnDownloadBatchPdf');
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Generando PDF con siluetas...';

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
        `${o.pecho || ''}`,
        `${o.cintura || ''}`,
        `${o.hombros || ''}`,
        `${o.manga || ''}`,
      ];

      cols.forEach((c, j) => doc.text(String(fila[j]), c[1], y));
      y += 7.5;
    });

    // Fichas individuales completas con la silueta
    for (let i = 0; i < orders.length; i++) {
      doc.addPage();
      await generarHojaInforme(doc, orders[i]);
    }

    const totalPaginas = doc.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 140, 120);
      doc.text(`Avocat Confecciones · Pagina ${p} de ${totalPaginas}`, 105, 290, { align: 'center' });
    }

    doc.save(`informe-maestro-taller-${new Date().toISOString().slice(0, 10)}.pdf`);
    btn.disabled = false;
    btn.textContent = oldText;
  });

  /* ------------------- EXPORTAR A EXCEL (CSV) ------------------- */
  $('btnExportCsv').addEventListener('click', function () {
    if (!orders.length) return;

    const cabeceras = [
      'ID Pedido',
      'Fecha',
      'Cliente',
      'Cantidad',
      'Tipo Prenda',
      'Talla Camisa',
      'Talla Pantalón',
      'Talla Sugerida',
      'Pecho (in)',
      'Cintura (in)',
      'Hombros (in)',
      'Largo Manga (in)',
      'Cintura Pantalón (in)',
      'Largo Pantalón (in)',
      'Hombro Cuello (in)',
      'Torso (in)',
      'Notas',
    ];

    const filas = orders.map((o) => [
      `"${o.id}"`,
      `"${formatearFecha(o.fecha)}"`,
      `"${(o.nombre || '').replace(/"/g, '""')}"`,
      o.cantidad,
      `"${o.tipo_prenda || 'ambos'}"`,
      `"${o.talla || ''}"`,
      `"${o.talla_pantalon || ''}"`,
      `"${o.tallaSugerida || ''}"`,
      o.pecho || '',
      o.cintura || '',
      o.hombros || '',
      o.manga || '',
      o.cintura_pantalon || '',
      o.largo_pantalon || '',
      o.hombro_cuello || '',
      o.torso || '',
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
  } else {
    mostrarLogin();
  }
})();
