let wikiData = [];
let networkInstance = null;
let currentCategory = "todos";

// Cargar los datos desde el JSON dentro de la misma carpeta web
async function loadWikiData() {
    try {
        const response = await fetch('wiki_database.json');
        wikiData = await response.json();
        
        initFilters();
        renderCards();
        initGraph();
    } catch (error) {
        console.error("Error al cargar wiki_database.json:", error);
        document.getElementById('cards-grid').innerHTML = `<p style="color:red">No se encontró el archivo 'wiki_database.json'. Ejecuta el comando !sync en Discord primero.</p>`;
    }
}

// Helper: Formatea y limpia nombres de forma segura
function cleanText(text) {
    if (!text) return "";
    let str = text.toString()
        .replace(/^(world_|npc_|lugar_|obj_|objeto_|faccion_|trama_)/i, '')
        .replace(/_/g, ' ');
    
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDisplayName(idOrName) {
    if (!idOrName) return "";
    const found = wikiData.find(i => i.id === idOrName);
    if (found && found.nombre) return found.nombre;
    return cleanText(idOrName);
}

// Inicializar Filtros
function initFilters() {
    const worldSelect = document.getElementById('filter-world');
    const tabsNav = document.getElementById('category-tabs');

    const mundos = [...new Set(wikiData.map(item => item.mundo_id).filter(Boolean))];
    worldSelect.innerHTML = `<option value="all">🌍 Todos los Mundos</option>`;
    mundos.forEach(m => {
        worldSelect.innerHTML += `<option value="${m}">${getDisplayName(m)}</option>`;
    });

    const tipos = ["todos", ...new Set(wikiData.map(item => item.tipo).filter(Boolean))];
    tabsNav.innerHTML = tipos.map(t => 
        `<button class="tab-btn ${t === 'todos' ? 'active' : ''}" onclick="setCategory('${t}', this)">${t.toUpperCase()}</button>`
    ).join('');
}

function setCategory(category, btn) {
    currentCategory = category;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCards();
}

// Renderizar Tarjetas
function renderCards() {
    const grid = document.getElementById('cards-grid');
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const selectedWorld = document.getElementById('filter-world').value;

    const filtered = wikiData.filter(item => {
        const matchesCategory = currentCategory === 'todos' || item.tipo === currentCategory;
        const matchesWorld = selectedWorld === 'all' || item.mundo_id === selectedWorld;
        const matchesSearch = (item.nombre || '').toLowerCase().includes(searchText) || 
                              (item.id || '').toLowerCase().includes(searchText);
        return matchesCategory && matchesWorld && matchesSearch;
    });

    grid.innerHTML = filtered.map(item => `
        <div class="card" onclick="openModal('${item.id}')">
            ${item.imagenes && item.imagenes.length > 0 ? 
                `<img src="${item.imagenes[0]}" class="card-img" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''}
            <div class="card-body">
                <span class="card-type">${item.tipo || 'entidad'}</span>
                <h3 class="card-title">${item.nombre || item.id}</h3>
                <div class="card-world">🌍 ${getDisplayName(item.mundo_id)}</div>
                <div class="tags">
                    ${item.etiquetas_discord ? item.etiquetas_discord.map(t => `<span class="tag">${t}</span>`).join('') : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Grafo Interactivo
function initGraph() {
    const container = document.getElementById('network-graph');

    const nodes = wikiData.map(item => ({
        id: item.id,
        label: item.nombre || item.id,
        group: item.tipo || 'desconocido',
        shape: 'dot',
        size: item.tipo === 'mundo' ? 25 : 15
    }));

    const edges = [];
    wikiData.forEach(item => {
        if (item.relaciones) {
            let relList = [];
            if (Array.isArray(item.relaciones)) {
                relList = item.relaciones;
            } else if (typeof item.relaciones === 'object') {
                Object.values(item.relaciones).forEach(v => {
                    if (Array.isArray(v)) relList.push(...v);
                });
            }

            relList.forEach(rel => {
                const targetId = typeof rel === 'string' ? rel : (rel.id_destino || '');
                if (targetId) {
                    edges.push({
                        from: item.id,
                        to: targetId,
                        label: cleanText(rel.relacion || ''),
                        arrows: 'to',
                        color: { color: '#89b4fa' }
                    });
                }
            });
        }
    });

    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
        nodes: { font: { color: '#ffffff', size: 14 } },
        physics: { solver: 'forceAtlas2Based' }
    };

    networkInstance = new vis.Network(container, data, options);

    networkInstance.on("click", function (params) {
        if (params.nodes.length > 0) {
            openModal(params.nodes[0]);
        }
    });
}

function setMainImage(url) {
    const mainImg = document.getElementById('main-modal-img');
    if (mainImg) mainImg.src = url;
}

// Modal de detalles
function openModal(id) {
    const item = wikiData.find(i => i.id === id);
    if (!item) return;

    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');

    const hasImage = item.imagenes && item.imagenes.length > 0;

    // Título dinámico
    const itemType = (item.tipo || 'entidad').toLowerCase();
    const isCharacter = ['npc', 'pc', 'personaje'].includes(itemType);
    const sectionTitle = isCharacter ? '📖 Biografía' : '📖 Descripción';

    // 1. Limpiar imágenes del markdown
    let cleanLoreText = (item.contenido_lore || '').replace(/!\[.*?\]\(.*?\)/g, '');

    // 2. ELIMINAR TÍTULOS REPETIDOS AL PRINCIPIO (Ej: "Descripción", "### Descripción", "Biografía", etc.)
    cleanLoreText = cleanLoreText.replace(/^\s*(?:#+\s*)?(?:Biograf[ií]a(?:\s+y\s+[Tr|tr]asfondo)?|Descripci[oó]n)\s*\n+/i, '');

    // NORMALIZAR RELACIONES
    let rawRelaciones = [];
    if (Array.isArray(item.relaciones)) {
        rawRelaciones = item.relaciones;
    } else if (item.relaciones && typeof item.relaciones === 'object') {
        Object.entries(item.relaciones).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                val.forEach(v => {
                    if (typeof v === 'object' && v.id_destino) rawRelaciones.push(v);
                    else if (typeof v === 'string') rawRelaciones.push({ id_destino: v, relacion: key });
                });
            } else if (typeof val === 'string') {
                rawRelaciones.push({ id_destino: val, relacion: key });
            }
        });
    }

    const directRelations = rawRelaciones.map(r => {
        if (typeof r === 'string') {
            return { targetId: r, label: 'Relacionado', name: getDisplayName(r) };
        }
        const tId = r.id_destino || r.target_id || '';
        return {
            targetId: tId,
            label: cleanText(r.relacion || 'Vínculo'),
            name: getDisplayName(tId)
        };
    }).filter(r => r.targetId !== '');

    const directTargetIds = new Set(directRelations.map(r => r.targetId));

    // Menciones inversas seguras
    const backlinks = wikiData
        .filter(other => {
            if (other.id === item.id || !other.relaciones) return false;
            if (directTargetIds.has(other.id)) return false;
            
            if (Array.isArray(other.relaciones)) {
                return other.relaciones.some(r => (r.id_destino || r) === item.id);
            } else if (typeof other.relaciones === 'object') {
                return JSON.stringify(other.relaciones).includes(item.id);
            }
            return false;
        })
        .map(other => ({
            targetId: other.id,
            label: `Mencionado en ${cleanText(other.tipo || 'Ficha')}`,
            name: other.nombre || other.id
        }));

    const allConnections = [...directRelations, ...backlinks];

    const directConnections = [];
    const tramaConnections = [];

    allConnections.forEach(c => {
        const targetObj = wikiData.find(i => i.id === c.targetId);
        const isTrama = (targetObj && targetObj.tipo === 'trama') || c.label.toLowerCase().includes('trama');
        
        if (isTrama) {
            tramaConnections.push(c);
        } else {
            directConnections.push(c);
        }
    });

    modalBody.innerHTML = `
        <div class="modal-grid" style="${!hasImage ? 'grid-template-columns: 1fr;' : ''}">
            ${hasImage ? `
                <div class="modal-media">
                    <img id="main-modal-img" src="${item.imagenes[0]}" class="modal-img-large" referrerpolicy="no-referrer" onerror="this.style.display='none'">
                    ${item.imagenes.length > 1 ? `
                        <div class="gallery-thumbs">
                            ${item.imagenes.map(img => `<img src="${img}" class="thumb-img" referrerpolicy="no-referrer" onclick="setMainImage('${img}')">`).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <div class="modal-info">
                <div class="modal-header">
                    <h2>${item.nombre || item.id}</h2>
                    <div class="modal-subtitle">
                        <span>📌 ${(item.tipo || 'ENTIDAD').toUpperCase()}</span>
                        <span>🌍 ${getDisplayName(item.mundo_id)}</span>
                    </div>
                </div>

                <!-- Atributos -->
                ${item.detalles && Object.keys(item.detalles).length > 0 ? `
                    <div class="attributes-row">
                        ${Object.entries(item.detalles).map(([k, v]) => `
                            <div class="attr-item">
                                <span class="attr-label">${cleanText(k)}</span>
                                <span class="attr-value">${cleanText(Array.isArray(v) ? v.join(', ') : v)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Lore / Biografía limpia sin título duplicado -->
                <div class="lore-section">
                    <h3>${sectionTitle}</h3>
                    ${cleanLoreText.trim() ? marked.parse(cleanLoreText) : '<p class="empty-lore">Sin información detallada registrada aún.</p>'}
                </div>

                <!-- Conexiones Directas -->
                ${directConnections.length > 0 ? `
                    <div class="connections-section">
                        <h3>🔗 Conexiones y Vínculos (${directConnections.length})</h3>
                        <div class="connection-chips">
                            ${directConnections.map(c => `
                                <a href="#" class="chip-link" onclick="openModal('${c.targetId}')">
                                    <span class="chip-relation">${c.label}:</span>
                                    <span class="chip-name">${c.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Desplegable para Tramas -->
                ${tramaConnections.length > 0 ? `
                    <details class="tramas-details">
                        <summary>📜 Ver Tramas asociadas (${tramaConnections.length})</summary>
                        <div class="connection-chips">
                            ${tramaConnections.map(c => `
                                <a href="#" class="chip-link" onclick="openModal('${c.targetId}')">
                                    <span class="chip-relation">${c.label}:</span>
                                    <span class="chip-name">${c.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}

            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

// Eventos de la UI
document.querySelector('.close-btn').onclick = () => document.getElementById('detail-modal').classList.add('hidden');
document.getElementById('search-input').oninput = renderCards;
document.getElementById('filter-world').onchange = renderCards;

document.getElementById('btn-cards').onclick = function() {
    document.getElementById('view-cards').classList.add('active');
    document.getElementById('view-graph').classList.remove('active');
    this.classList.add('active');
    document.getElementById('btn-graph').classList.remove('active');
};

document.getElementById('btn-graph').onclick = function() {
    document.getElementById('view-graph').classList.add('active');
    document.getElementById('view-cards').classList.remove('active');
    this.classList.add('active');
    document.getElementById('btn-cards').classList.remove('active');
};

window.onload = loadWikiData;