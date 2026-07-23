let wikiData = [];
let networkInstance = null;
let currentCategory = "todos";

// Cargar los datos desde el JSON
async function loadWikiData() {
    try {
        const response = await fetch('../wiki_database.json');
        wikiData = await response.json();
        
        initFilters();
        renderCards();
        initGraph();
    } catch (error) {
        console.error("Error al cargar wiki_database.json:", error);
        document.getElementById('cards-grid').innerHTML = `<p style="color:red">No se encontró el archivo 'wiki_database.json'. Ejecuta el comando !sync en Discord primero.</p>`;
    }
}

// Helper: Formatea y limpia nombres y textos (quita guiones bajos)
function cleanText(text) {
    if (!text) return "";
    return text
        .toString()
        .replace(/^(world_|npc_|lugar_|obj_|objeto_|faccion_|trama_)/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
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

    const mundos = [...new Set(wikiData.map(item => item.mundo_id))];
    worldSelect.innerHTML = `<option value="all">🌍 Todos los Mundos</option>`;
    mundos.forEach(m => {
        worldSelect.innerHTML += `<option value="${m}">${getDisplayName(m)}</option>`;
    });

    const tipos = ["todos", ...new Set(wikiData.map(item => item.tipo))];
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
        const matchesSearch = item.nombre.toLowerCase().includes(searchText) || 
                              item.id.toLowerCase().includes(searchText);
        return matchesCategory && matchesWorld && matchesSearch;
    });

    grid.innerHTML = filtered.map(item => `
        <div class="card" onclick="openModal('${item.id}')">
            ${item.imagenes && item.imagenes.length > 0 ? `<img src="${item.imagenes[0]}" class="card-img">` : ''}
            <div class="card-body">
                <span class="card-type">${item.tipo}</span>
                <h3 class="card-title">${item.nombre}</h3>
                <div class="card-world">🌍 ${getDisplayName(item.mundo_id)}</div>
                <div class="tags">
                    ${item.etiquetas_discord ? item.etiquetas_discord.map(t => `<span class="tag">${t}</span>`).join('') : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Grafo
function initGraph() {
    const container = document.getElementById('network-graph');

    const nodes = wikiData.map(item => ({
        id: item.id,
        label: item.nombre,
        group: item.tipo,
        shape: 'dot',
        size: item.tipo === 'mundo' ? 25 : 15
    }));

    const edges = [];
    wikiData.forEach(item => {
        if (item.relaciones && Array.isArray(item.relaciones)) {
            item.relaciones.forEach(rel => {
                edges.push({
                    from: item.id,
                    to: rel.id_destino,
                    label: rel.relacion || '',
                    arrows: 'to',
                    color: { color: '#89b4fa' }
                });
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

// Modal de detalles LIMPIO Y SIN DUPLICADOS
function openModal(id) {
    const item = wikiData.find(i => i.id === id);
    if (!item) return;

    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');

    const hasImage = item.imagenes && item.imagenes.length > 0;

    // 1. Recopilar Relaciones Directas
    const directRelations = (item.relaciones || []).map(r => ({
        targetId: r.id_destino,
        label: cleanText(r.relacion),
        name: getDisplayName(r.id_destino)
    }));

    const directTargetIds = new Set(directRelations.map(r => r.targetId));

    // 2. Recopilar Menciones Inversas (Excluyendo las que ya están en las relaciones directas)
    const backlinks = wikiData
        .filter(other => 
            other.id !== item.id && 
            other.relaciones && 
            other.relaciones.some(r => r.id_destino === item.id) &&
            !directTargetIds.has(other.id) // ¡Evita duplicados!
        )
        .map(other => ({
            targetId: other.id,
            label: `Mencionado en ${cleanText(other.tipo)}`,
            name: other.nombre
        }));

    // 3. Unificar todas las conexiones sin repetir
    const allConnections = [...directRelations, ...backlinks];

    modalBody.innerHTML = `
        <div class="modal-grid" style="${!hasImage ? 'grid-template-columns: 1fr;' : ''}">
            ${hasImage ? `
                <div class="modal-media">
                    <img id="main-modal-img" src="${item.imagenes[0]}" class="modal-img-large">
                    ${item.imagenes.length > 1 ? `
                        <div class="gallery-thumbs">
                            ${item.imagenes.map(img => `<img src="${img}" class="thumb-img" onclick="setMainImage('${img}')">`).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <div class="modal-info">
                <div class="modal-header">
                    <h2>${item.nombre}</h2>
                    <div class="modal-subtitle">
                        <span>📌 ${item.tipo.toUpperCase()}</span>
                        <span>🌍 ${getDisplayName(item.mundo_id)}</span>
                    </div>
                </div>

                <!-- Atributos limpios sin guiones bajos -->
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

                <!-- Lore / Biografía -->
                <div class="lore-section">
                    <h3>📖 Biografía / Descripción</h3>
                    ${item.contenido_lore ? marked.parse(item.contenido_lore) : '<p class="empty-lore">Sin descripción detallada registrada aún.</p>'}
                </div>

                <!-- Conexiones Unificadas en Chips Horizontales (Sin duplicados) -->
                ${allConnections.length > 0 ? `
                    <div class="connections-section">
                        <h3>🔗 Conexiones y Vínculos (${allConnections.length})</h3>
                        <div class="connection-chips">
                            ${allConnections.map(c => `
                                <a href="#" class="chip-link" onclick="openModal('${c.targetId}')">
                                    <span class="chip-relation">${c.label}:</span>
                                    <span class="chip-name">${c.name}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
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