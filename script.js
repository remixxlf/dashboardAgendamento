// ================================================================
//  CONFIGURAÇÃO DO SUPABASE
//  Substitua os valores pelas suas credenciais reais.
//  Nunca exponha chaves de serviço (service_role) no front-end;
//  use sempre a anon key com Row-Level Security (RLS) ativado.
// ================================================================
const SUPABASE_URL      = 'https://kuvqqcfeysdllpoklryz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mkeFhZVMVGwyIcLo042Q1A__kX-hNzi';

// Cabeçalhos HTTP exigidos pela API REST do Supabase
const HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type':  'application/json',
};

// ================================================================
//  ESTADO DA APLICAÇÃO
// ================================================================
let agendamentosDoMes = [];   // cache dos agendamentos buscados
let diaSelecionado    = null; // 'YYYY-MM-DD' ou null

// Referências a elementos do DOM
const selectMes        = document.getElementById('selectMes');
const selectAno        = document.getElementById('selectAno');
const btnHoje          = document.getElementById('btnHoje');
const gradeDias        = document.getElementById('gradeDias');
const tituloCalendario = document.getElementById('tituloCalendario');
const tituloPainel     = document.getElementById('tituloPainel');
const areaDosCartoes   = document.getElementById('areaDosCartoes');

// ================================================================
//  DADOS AUXILIARES
// ================================================================
const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// ================================================================
//  INICIALIZAÇÃO DOS SELECTS DE MÊS E ANO
// ================================================================
function inicializarControles() {
  // Preenche o select de meses
  MESES.forEach((nome, i) => {
    const opt = document.createElement('option');
    opt.value       = i;     // 0 = Janeiro … 11 = Dezembro
    opt.textContent = nome;
    selectMes.appendChild(opt);
  });

  // Preenche o select de anos (3 anos passados + 2 futuros)
  const anoAtual = new Date().getFullYear();
  for (let a = anoAtual - 3; a <= anoAtual + 2; a++) {
    const opt = document.createElement('option');
    opt.value       = a;
    opt.textContent = a;
    selectAno.appendChild(opt);
  }

  // Define o mês e ano correntes como padrão
  const hoje = new Date();
  selectMes.value = hoje.getMonth();
  selectAno.value = hoje.getFullYear();
}

// ================================================================
//  FUNÇÕES DE ACESSO AO SUPABASE
// ================================================================

/**
 * Busca todos os agendamentos de um mês/ano específico.
 * Usa os operadores gte (>=) e lte (<=) da API REST do Supabase.
 *
 * @param {number} ano  - Ex.: 2025
 * @param {number} mes  - 0-indexado (0 = Janeiro)
 * @returns {Array}     - Lista de agendamentos ou [] em caso de erro
 */
async function buscarAgendamentosDoMes(ano, mes) {
  // Formata o primeiro e o último dia do mês como YYYY-MM-DD
  const mm     = String(mes + 1).padStart(2, '0');
  const inicio = `${ano}-${mm}-01`;
  const ultimo = new Date(ano, mes + 1, 0).getDate(); // último dia
  const fim    = `${ano}-${mm}-${String(ultimo).padStart(2, '0')}`;

  // Constrói a URL com filtros e ordenação
  const url =
    `${SUPABASE_URL}/rest/v1/agendamentos` +
    `?data=gte.${inicio}` +          // data >= primeiro dia
    `&data=lte.${fim}` +             // data <= último dia
    `&order=data.asc,hora.asc` +     // ordena por data e hora
    `&select=*`;                     // retorna todas as colunas

  try {
    const resposta = await fetch(url, { headers: HEADERS });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return await resposta.json();
  } catch (erro) {
    console.error('[Supabase] Erro ao buscar agendamentos:', erro);
    return [];
  }
}

// ================================================================
//  RENDERIZAÇÃO DO CALENDÁRIO
// ================================================================

/**
 * Desenha o grid mensal, colocando um badge numérico
 * nos dias que possuem agendamentos.
 */
function renderizarCalendario(ano, mes, agendamentos) {
  tituloCalendario.textContent = `${MESES[mes]} de ${ano}`;

  // Conta agendamentos por dia  →  { 'YYYY-MM-DD': N }
  const contagemPorDia = {};
  agendamentos.forEach(ag => {
    contagemPorDia[ag.data] = (contagemPorDia[ag.data] || 0) + 1;
  });

  gradeDias.innerHTML = ''; // limpa o grid anterior

  const mm          = String(mes + 1).padStart(2, '0');
  const primeiroDia = new Date(ano, mes, 1).getDay(); // 0=Dom … 6=Sáb
  const totalDias   = new Date(ano, mes + 1, 0).getDate();
  const hoje        = new Date();

  // Células "mudas" antes do primeiro dia da semana
  for (let i = 0; i < primeiroDia; i++) {
    const vazio = document.createElement('div');
    vazio.className = 'dia-celula vazio';
    gradeDias.appendChild(vazio);
  }

  // Uma célula por dia do mês
  for (let d = 1; d <= totalDias; d++) {
    const dd      = String(d).padStart(2, '0');
    const dataStr = `${ano}-${mm}-${dd}`;

    const celula = document.createElement('div');
    celula.className = 'dia-celula';
    celula.setAttribute('role', 'gridcell');
    celula.setAttribute('tabindex', '0');
    celula.setAttribute('aria-label', `${d} de ${MESES[mes]}, ${contagemPorDia[dataStr] || 0} agendamento(s)`);

    // Destaca o dia de hoje
    const ehHoje =
      d === hoje.getDate() &&
      mes === hoje.getMonth() &&
      ano === hoje.getFullYear();
    if (ehHoje)          celula.classList.add('hoje');
    if (dataStr === diaSelecionado) celula.classList.add('ativo');

    // Número do dia
    const numDia = document.createElement('span');
    numDia.className   = 'num-dia';
    numDia.textContent = d;
    celula.appendChild(numDia);

    // Badge de contagem (só aparece quando há agendamentos)
    if (contagemPorDia[dataStr]) {
      const badge = document.createElement('span');
      badge.className   = 'qtd-badge';
      badge.textContent = contagemPorDia[dataStr];
      celula.appendChild(badge);
    }

    // Clique e teclado (Enter/Space) selecionam o dia
    celula.addEventListener('click', () => selecionarDia(dataStr));
    celula.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') selecionarDia(dataStr);
    });

    gradeDias.appendChild(celula);
  }
}

// ================================================================
//  SELEÇÃO DE DIA E LISTAGEM DE AGENDAMENTOS
// ================================================================

/**
 * Marca o dia clicado como ativo e exibe seus agendamentos.
 * @param {string} dataStr - 'YYYY-MM-DD'
 */
function selecionarDia(dataStr) {
  diaSelecionado = dataStr;

  // Remove classe 'ativo' de todas as células e adiciona à selecionada
  document.querySelectorAll('.dia-celula').forEach(el => el.classList.remove('ativo'));
  const diaNum = parseInt(dataStr.split('-')[2]);
  document.querySelectorAll('.dia-celula:not(.vazio)').forEach(el => {
    if (parseInt(el.querySelector('.num-dia')?.textContent) === diaNum) {
      el.classList.add('ativo');
    }
  });

  // Filtra apenas os agendamentos do dia escolhido
  const agsDoDia = agendamentosDoMes.filter(ag => ag.data === dataStr);

  // Formata a data para exibição em português
  const dataFormatada = new Date(dataStr + 'T00:00:00')
    .toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric',
      month: 'long', year: 'numeric'
    });

  tituloPainel.textContent = `Agendamentos — ${dataFormatada}`;
  renderizarListaAgendamentos(agsDoDia);
}

/**
 * Gera os cartões de agendamento dentro do painel de detalhes.
 * @param {Array} lista - Agendamentos filtrados por dia
 */
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
    // Converte "HH:MM:SS" → "HH:MM"
    const hora = ag.hora ? ag.hora.substring(0, 5) : '--:--';

    const card = document.createElement('article');
    card.className = 'card-agendamento';
    card.innerHTML = `
      <div class="card-hora">${hora}</div>
      <div class="card-info">
        <div class="cliente">${ag.cliente_nome}</div>
        <div class="servico">${ag.servico}</div>
      </div>
      ${ag.barbeiro
        ? `<div class="card-barbeiro">✂️ ${ag.barbeiro}</div>`
        : ''}
    `;
    container.appendChild(card);
  });

  areaDosCartoes.innerHTML = '';
  areaDosCartoes.appendChild(container);
}

// ================================================================
//  FLUXO PRINCIPAL — CARREGAR MÊS
// ================================================================

/**
 * Chamado sempre que o mês/ano muda ou ao iniciar a página.
 * Busca os dados no Supabase e re-renderiza tudo.
 */
async function carregarMes() {
  const ano = parseInt(selectAno.value);
  const mes = parseInt(selectMes.value);

  // Reseta o estado do painel de detalhes
  diaSelecionado        = null;
  tituloPainel.textContent = 'Selecione um dia no calendário';
  areaDosCartoes.innerHTML = `
    <div class="estado-vazio">
      <span class="icone">📅</span>
      Clique em um dia para listar os agendamentos.
    </div>`;

  // Indicador visual de carregamento
  gradeDias.innerHTML = `
    <p style="grid-column:span 7;text-align:center;
              color:#555;padding:2rem 0;">
      Carregando…
    </p>`;

  // Busca dados do Supabase e renderiza o calendário
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
inicializarControles();
carregarMes();
