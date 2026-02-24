// ================================================================
//  CONFIGURAÇÃO DO SUPABASE
// ================================================================
const SUPABASE_URL      = 'https://kuvqqcfeysdllpoklryz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mkeFhZVMVGwyIcLo042Q1A__kX-hNzi';

const HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type':  'application/json',
};

// ================================================================
//  LÊ O ID DA BARBEARIA DA URL
//  Ex.: index.html?barbearia=UUID_AQUI
// ================================================================
const params       = new URLSearchParams(window.location.search);
const BARBEARIA_ID = params.get('barbearia');

// ================================================================
//  ESTADO DA APLICAÇÃO
// ================================================================
let agendamentosDoMes = [];
let diaSelecionado    = null;

const selectMes        = document.getElementById('selectMes');
const selectAno        = document.getElementById('selectAno');
const btnHoje          = document.getElementById('btnHoje');
const gradeDias        = document.getElementById('gradeDias');
const tituloCalendario = document.getElementById('tituloCalendario');
const tituloPainel     = document.getElementById('tituloPainel');
const areaDosCartoes   = document.getElementById('areaDosCartoes');
const tituloBarbearia  = document.getElementById('tituloBarbearia');

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// ================================================================
//  INICIALIZAÇÃO
// ================================================================
function inicializarControles() {
  MESES.forEach((nome, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = nome;
    selectMes.appendChild(opt);
  });

  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual - 3; a <= anoAtual + 2; a++) {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    selectAno.appendChild(opt);
  }

  const hoje = new Date();
  selectMes.value = hoje.getMonth();
  selectAno.value = hoje.getFullYear();
}

// ================================================================
//  CARREGA O NOME DA BARBEARIA E EXIBE NO CABEÇALHO
// ================================================================
async function carregarNomeBarbearia() {
  if (!BARBEARIA_ID) {
    tituloBarbearia.textContent = '⚠️ Acesse com ?barbearia=UUID na URL';
    return;
  }

  const url = `${SUPABASE_URL}/rest/v1/barbearias?id=eq.${BARBEARIA_ID}&select=nome`;
  try {
    const res  = await fetch(url, { headers: HEADERS });
    const rows = await res.json();
    if (rows.length) {
      tituloBarbearia.textContent = `✂️ ${rows[0].nome} — Agendamentos`;
      document.title = `${rows[0].nome} — Agendamentos`;
    } else {
      tituloBarbearia.textContent = '⚠️ Barbearia não encontrada';
    }
  } catch (e) {
    console.error('[Supabase] carregarNomeBarbearia:', e);
  }
}

// ================================================================
//  BUSCA AGENDAMENTOS FILTRADOS POR BARBEARIA E MÊS
// ================================================================
async function buscarAgendamentosDoMes(ano, mes) {
  if (!BARBEARIA_ID) return [];

  const mm     = String(mes + 1).padStart(2, '0');
  const inicio = `${ano}-${mm}-01`;
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const fim    = `${ano}-${mm}-${String(ultimo).padStart(2, '0')}`;

  const url =
    `${SUPABASE_URL}/rest/v1/agendamentos` +
    `?barbearia_id=eq.${BARBEARIA_ID}` +  // ← filtro por barbearia
    `&data=gte.${inicio}` +
    `&data=lte.${fim}` +
    `&order=data.asc,hora.asc` +
    `&select=*`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[Supabase] buscarAgendamentosDoMes:', e);
    return [];
  }
}

// ================================================================
//  RENDERIZAÇÃO DO CALENDÁRIO
// ================================================================
function renderizarCalendario(ano, mes, agendamentos) {
  tituloCalendario.textContent = `${MESES[mes]} de ${ano}`;

  const contagemPorDia = {};
  agendamentos.forEach(ag => {
    contagemPorDia[ag.data] = (contagemPorDia[ag.data] || 0) + 1;
  });

  gradeDias.innerHTML = '';

  const mm          = String(mes + 1).padStart(2, '0');
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias   = new Date(ano, mes + 1, 0).getDate();
  const hoje        = new Date();

  for (let i = 0; i < primeiroDia; i++) {
    const v = document.createElement('div');
    v.className = 'dia-celula vazio';
    gradeDias.appendChild(v);
  }

  for (let d = 1; d <= totalDias; d++) {
    const dd      = String(d).padStart(2, '0');
    const dataStr = `${ano}-${mm}-${dd}`;

    const celula = document.createElement('div');
    celula.className = 'dia-celula';
    celula.setAttribute('role', 'gridcell');
    celula.setAttribute('tabindex', '0');
    celula.setAttribute('aria-label',
      `${d} de ${MESES[mes]}, ${contagemPorDia[dataStr] || 0} agendamento(s)`);

    const ehHoje =
      d === hoje.getDate() &&
      mes === hoje.getMonth() &&
      ano === hoje.getFullYear();

    if (ehHoje) celula.classList.add('hoje');
    if (dataStr === diaSelecionado) celula.classList.add('ativo');

    const numDia = document.createElement('span');
    numDia.className   = 'num-dia';
    numDia.textContent = d;
    celula.appendChild(numDia);

    if (contagemPorDia[dataStr]) {
      const badge = document.createElement('span');
      badge.className   = 'qtd-badge';
      badge.textContent = contagemPorDia[dataStr];
      celula.appendChild(badge);
    }

    celula.addEventListener('click', () => selecionarDia(dataStr));
    celula.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selecionarDia(dataStr);
    });

    gradeDias.appendChild(celula);
  }
}

// ================================================================
//  SELEÇÃO DE DIA
// ================================================================
function selecionarDia(dataStr) {
  diaSelecionado = dataStr;

  document.querySelectorAll('.dia-celula').forEach(el => el.classList.remove('ativo'));
  const diaNum = parseInt(dataStr.split('-')[2]);
  document.querySelectorAll('.dia-celula:not(.vazio)').forEach(el => {
    if (parseInt(el.querySelector('.num-dia')?.textContent) === diaNum) {
      el.classList.add('ativo');
    }
  });

  const agsDoDia = agendamentosDoMes.filter(ag => ag.data === dataStr);

  const dataFormatada = new Date(dataStr + 'T00:00:00')
    .toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric',
      month: 'long', year: 'numeric'
    });

  tituloPainel.textContent = `Agendamentos — ${dataFormatada}`;
  renderizarListaAgendamentos(agsDoDia);
}

// ================================================================
//  RENDERIZAÇÃO DOS CARTÕES
// ================================================================
function renderizarListaAgendamentos(lista) {
  if (!lista.length) {
    areaDosCartoes.innerHTML = `
      <div class="estado-vazio">
        <span class="icone">🚫</span>
        Nenhum agendamento neste dia.
      </div>`;
    return;
  }

  const container = document.createElement('div');
  container.className = 'lista-agendamentos';

  lista.forEach(ag => {
    const hora = ag.hora ? ag.hora.substring(0, 5) : '--:--';
    const card = document.createElement('article');
    card.className = 'card-agendamento';
    card.innerHTML = `
      <div class="card-hora">${hora}</div>
      <div class="card-info">
        <div class="cliente">${ag.cliente_nome}</div>
        <div class="servico">${ag.servico}</div>
      </div>
      ${ag.barbeiro ? `<div class="card-barbeiro">✂️ ${ag.barbeiro}</div>` : ''}
    `;
    container.appendChild(card);
  });

  areaDosCartoes.innerHTML = '';
  areaDosCartoes.appendChild(container);
}

// ================================================================
//  CARREGAR MÊS
// ================================================================
async function carregarMes() {
  const ano = parseInt(selectAno.value);
  const mes = parseInt(selectMes.value);

  diaSelecionado           = null;
  tituloPainel.textContent = 'Selecione um dia no calendário';
  areaDosCartoes.innerHTML = `
    <div class="estado-vazio">
      <span class="icone">📅</span>
      Clique em um dia para listar os agendamentos.
    </div>`;

  gradeDias.innerHTML = `
    <p style="grid-column:span 7;text-align:center;color:#555;padding:2rem 0;">
      Carregando…
    </p>`;

  agendamentosDoMes = await buscarAgendamentosDoMes(ano, mes);
  renderizarCalendario(ano, mes, agendamentosDoMes);
}

// ================================================================
//  EVENT LISTENERS
// ================================================================
selectMes.addEventListener('change', carregarMes);
selectAno.addEventListener('change', carregarMes);
btnHoje.addEventListener('click', () => {
  const hoje = new Date();
  selectMes.value = hoje.getMonth();
  selectAno.value = hoje.getFullYear();
  carregarMes();
});

// ================================================================
//  PONTO DE ENTRADA
// ================================================================
if (!BARBEARIA_ID) {
  document.getElementById('tituloBarbearia').textContent =
    '⚠️ Acesse com ?barbearia=UUID — Ex.: index.html?barbearia=abc-123';
}

inicializarControles();
carregarNomeBarbearia();
carregarMes();
