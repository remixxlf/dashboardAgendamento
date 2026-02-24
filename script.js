// ══ CONFIG ═══════════════════════════════════════════════════
const SUPABASE_URL      = 'https://kuvqqcfeysdllpoklryz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mkeFhZVMVGwyIcLo042Q1A__kX-hNzi';
const headers = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

const params = new URLSearchParams(location.search);
const barbId = params.get('barbearia');

// ══ ESTADO ═══════════════════════════════════════════════════
let dataAtual               = new Date();
let agendamentoParaCancelar = null;
let configAutenticado       = false;

// ══ INICIALIZAÇÃO ════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  if (!barbId) {
    document.body.innerHTML = `
      <p style="text-align:center;padding:60px;color:#666">
        Link inválido. ID da barbearia não encontrado.
      </p>`;
    return;
  }
  await carregarBarbearia();
  renderizarData();
  await carregarAgendamentos();
  renderizarDiasGrid();
});

// ══ BARBEARIA ════════════════════════════════════════════════
async function carregarBarbearia() {
  const r   = await fetch(
    `${SUPABASE_URL}/rest/v1/barbearias?id=eq.${barbId}&select=*`,
    { headers }
  );
  const [b] = await r.json();
  if (!b) return;

  document.getElementById('nomeBar').textContent   = `✂️ ${b.nome}`;
  document.getElementById('statusBar').textContent = '🟢 online';

  if (b.horario_inicio)    document.getElementById('cfgInicio').value       = b.horario_inicio;
  if (b.horario_fim)       document.getElementById('cfgFim').value          = b.horario_fim;
  if (b.intervalo_minutos) document.getElementById('cfgIntervalo').value    = b.intervalo_minutos;
  if (b.almoco_inicio)     document.getElementById('cfgAlmocoInicio').value = b.almoco_inicio;
  if (b.almoco_fim)        document.getElementById('cfgAlmocoFim').value    = b.almoco_fim;

  await carregarServicos();
}

// ══ DATA / NAVEGAÇÃO ═════════════════════════════════════════
const SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES  = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function renderizarData() {
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  dataAtual.setHours(0,0,0,0);

  const d   = dataAtual;
  const str = `${SEMANA[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;

  document.getElementById('labelData').textContent =
    dataAtual.getTime() === hoje.getTime() ? `Hoje — ${str}` : str;

  document.getElementById('btnAntes').disabled =
    dataAtual.getTime() <= hoje.getTime();
}

function mudarData(delta) {
  dataAtual.setDate(dataAtual.getDate() + delta);
  renderizarData();
  carregarAgendamentos();
}

function dataISO(d = dataAtual) {
  return d.toISOString().split('T')[0];
}

// ══ AGENDAMENTOS ═════════════════════════════════════════════
async function carregarAgendamentos() {
  const lista = document.getElementById('listaAgendamentos');
  lista.innerHTML = `<p class="vazio"><span>⏳</span>Carregando...</p>`;

  const r   = await fetch(
    `${SUPABASE_URL}/rest/v1/agendamentos?barbearia_id=eq.${barbId}&data=eq.${dataISO()}&order=horario.asc&select=*`,
    { headers }
  );
  const ags = await r.json();

  if (!ags.length) {
    lista.innerHTML = `<div class="vazio"><span>📭</span>Sem agendamentos neste dia.</div>`;
    return;
  }

  lista.innerHTML = ags.map(a => `
    <div class="card">
      <div class="horario">${a.horario?.slice(0,5)}</div>
      <div class="info">
        <div class="nome">${a.cliente_nome}</div>
        <div class="servico">${a.servico}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="badge badge-${a.status || 'agendado'}">${a.status || 'agendado'}</span>
        ${a.status !== 'cancelado'
          ? `<button class="btn-cancel-ag"
               onclick="abrirModal('${a.id}','${a.cliente_nome}','${a.horario?.slice(0,5)}')">
               Cancelar
             </button>`
          : ''}
      </div>
    </div>
  `).join('');
}

// ══ MODAL CANCELAMENTO ═══════════════════════════════════════
function abrirModal(id, nome, horario) {
  agendamentoParaCancelar = id;
  document.getElementById('modalTexto').innerHTML =
    `Cancelar agendamento de <b>${nome}</b> às <b>${horario}</b>?`;
  document.getElementById('overlay').classList.remove('hidden');
}

function fecharModal() {
  agendamentoParaCancelar = null;
  document.getElementById('overlay').classList.add('hidden');
}

async function confirmarCancelamento() {
  if (!agendamentoParaCancelar) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/agendamentos?id=eq.${agendamentoParaCancelar}`,
    { method: 'PATCH', headers, body: JSON.stringify({ status: 'cancelado' }) }
  );
  fecharModal();
  toast('Agendamento cancelado ✓');
  await carregarAgendamentos();
}

// ══ CONFIGURAÇÕES — SENHA ════════════════════════════════════
async function verificarSenha() {
  const digitada = document.getElementById('inputSenha').value.trim();
  if (!digitada) return;

  const r   = await fetch(
    `${SUPABASE_URL}/rest/v1/barbearias?id=eq.${barbId}&select=senha_dashboard`,
    { headers }
  );
  const [b] = await r.json();
  const ok  = !b?.senha_dashboard || b.senha_dashboard === digitada;

  if (ok) {
    configAutenticado = true;
    document.getElementById('telaSenha').style.display    = 'none';
    document.getElementById('painelConfig').style.display = 'block';
  } else {
    document.getElementById('erroSenha').textContent = '❌ Senha incorreta';
  }
}

function abrirConfigs(btn) {
  mudarTab('configuracoes', btn);
  if (configAutenticado) {
    document.getElementById('telaSenha').style.display    = 'none';
    document.getElementById('painelConfig').style.display = 'block';
  } else {
    document.getElementById('telaSenha').style.display    = 'flex';
    document.getElementById('painelConfig').style.display = 'none';
  }
}

// ══ DIAS DE FOLGA ════════════════════════════════════════════
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function renderizarDiasGrid() {
  document.getElementById('diasGrid').innerHTML =
    DIAS_SEMANA.map((d, i) => `
      <label class="dia-label">
        <input type="checkbox" class="dia-check" data-dia="${i}" />
        ${d}
      </label>
    `).join('');
}

// ══ SERVIÇOS ═════════════════════════════════════════════════
async function carregarServicos() {
  const r   = await fetch(
    `${SUPABASE_URL}/rest/v1/servicos?barbearia_id=eq.${barbId}&order=nome.asc&select=*`,
    { headers }
  );
  const svs = await r.json();
  document.getElementById('listaServicos').innerHTML = '';
  svs.forEach(sv => adicionarServico(sv.nome, sv.preco, sv.id));
}

function adicionarServico(nome = '', preco = '', id = '') {
  const lista = document.getElementById('listaServicos');
  const row   = document.createElement('div');
  row.className  = 'sv-row';
  row.dataset.id = id;
  row.innerHTML  = `
    <input placeholder="Nome do serviço" value="${nome}" class="sv-nome" />
    <input placeholder="R$ 0,00" value="${preco}" class="sv-preco" style="max-width:90px" />
    <button class="btn-rm" onclick="this.parentElement.remove()">✕</button>
  `;
  lista.appendChild(row);
}

// ══ SALVAR CONFIGS ═══════════════════════════════════════════
async function salvarConfigs() {
  const novaSenha = document.getElementById('cfgNovaSenha').value.trim();
  const confSenha = document.getElementById('cfgConfSenha').value.trim();

  if (novaSenha && novaSenha !== confSenha) {
    toast('❌ Senhas não coincidem', true);
    return;
  }

  const folgas = [...document.querySelectorAll('.dia-check:checked')]
    .map(c => parseInt(c.dataset.dia));

  const payload = {
    horario_inicio:    document.getElementById('cfgInicio').value,
    horario_fim:       document.getElementById('cfgFim').value,
    intervalo_minutos: parseInt(document.getElementById('cfgIntervalo').value),
    almoco_inicio:     document.getElementById('cfgAlmocoInicio').value,
    almoco_fim:        document.getElementById('cfgAlmocoFim').value,
    dias_folga:        folgas,
    ...(novaSenha ? { senha_dashboard: novaSenha } : {}),
  };

  await fetch(
    `${SUPABASE_URL}/rest/v1/barbearias?id=eq.${barbId}`,
    { method: 'PATCH', headers, body: JSON.stringify(payload) }
  );

  // salva serviços
  for (const row of document.querySelectorAll('.sv-row')) {
    const nome  = row.querySelector('.sv-nome').value.trim();
    const preco = row.querySelector('.sv-preco').value.trim();
    if (!nome) continue;
    const id = row.dataset.id;
    if (id) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/servicos?id=eq.${id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ nome, preco }) }
      );
    } else {
      await fetch(
        `${SUPABASE_URL}/rest/v1/servicos`,
        { method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ barbearia_id: barbId, nome, preco }) }
      );
    }
  }

  toast('✅ Configurações salvas!');
  if (novaSenha) {
    document.getElementById('cfgNovaSenha').value = '';
    document.getElementById('cfgConfSenha').value  = '';
  }
}

// ══ HELPERS ══════════════════════════════════════════════════
function mudarTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${id}`).classList.add('active');
  btn.classList.add('active');
}

let toastTimer;
function toast(msg, erro = false) {
  const el = document.getElementById('toast');
  el.textContent    = msg;
  el.style.background = erro ? 'var(--vermelho)' : 'var(--verde)';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
