// Calendário de vencimentos do mês
        function formatarData(dataISO) {
            if(!dataISO) return '--/--';
            const [ano, mes, dia] = dataISO.split('-');
            return `${dia}/${mes}`;
        }

        // === CALENDÁRIO DE VENCIMENTOS CORRIGIDO ===
        function renderizarCalendario() {
            const cal = document.getElementById('calendarioGrid');
            const label = document.getElementById('calendarioMesLabel');
            if(!cal || !label) return;

            const [ano, mes] = mesAtualKey.split('-').map(Number);
            label.innerText = `${_NOMES_MES[mes-1]} De ${ano}`;

            const diasNoMes = new Date(ano, mes, 0).getDate();
            const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
            const nomesDiasSemana = ['D','S','T','Q','Q','S','S'];

            let html = '';
            nomesDiasSemana.forEach(d => html += `<div class="cal-weekday">${d}</div>`);
            for(let i = 0; i < primeiroDiaSemana; i++) html += `<div class="cal-day empty"></div>`;

            const hoje = new Date();

            for(let dia = 1; dia <= diasNoMes; dia++) {
                const contasDoDia = (window.activeFixas || []).filter(f => f.vencimento === dia);
                const assinaturasDoDia = (assinaturasConfig || []).filter(a => a.vencimento === dia);
                
                const temPendente = contasDoDia.some(f => !f.pago);
                const temConta = contasDoDia.length > 0;
                const temAssinatura = assinaturasDoDia.length > 0;

                let classe = 'cal-day';
                if(temConta) {
                    classe += temPendente ? ' has-pending' : ' has-paid';
                } else if(temAssinatura) {
                    classe += ' has-sub';
                }
                
                if(hoje.getFullYear() === ano && (hoje.getMonth()+1) === mes && hoje.getDate() === dia) classe += ' today';
                if(diaCalendarioSelecionado === dia) classe += ' selected';

                html += `<div class="${classe}" onclick="mostrarEventosDia(${dia})">${dia}`;
                
                if(temConta && !temAssinatura) {
                    html += `<span class="cal-dot"></span>`;
                } else if (!temConta && temAssinatura) {
                    html += `<span class="sub-dot"></span>`;
                } else if (temConta && temAssinatura) {
                    html += `<span class="cal-dot dot-left"></span><span class="sub-dot dot-right"></span>`;
                }
                
                html += `</div>`;
            }

            cal.innerHTML = html;
            _renderizarEventosNaLista(diaCalendarioSelecionado);
        }

        function mostrarEventosDia(dia) {
            if(diaCalendarioSelecionado === dia) {
                diaCalendarioSelecionado = null; 
            } else {
                diaCalendarioSelecionado = dia;
            }
            renderizarCalendario();
        }

        function _renderizarEventosNaLista(dia) {
            const container = document.getElementById('calendarioEventos');
            if(!container) return;

            let listaContas = dia 
                ? (window.activeFixas || []).filter(f => f.vencimento === dia)
                : [...(window.activeFixas || [])].sort((a,b) => a.vencimento - b.vencimento);
                
            let listaSubs = dia 
                ? (assinaturasConfig || []).filter(s => s.vencimento === dia)
                : [...(assinaturasConfig || [])].sort((a,b) => a.vencimento - b.vencimento);

            const titulo = dia ? `Eventos - Dia ${dia}` : 'Todos os eventos do mês';
            // Só clicando de novo no mesmo dia (pra desmarcar) voltava a mostrar o mês inteiro —
            // esse botão deixa explícito como voltar, sem depender de lembrar esse detalhe.
            const botaoVoltar = dia ? `<button class="cal-eventos-voltar" onclick="verTodosEventosDoMes()"><i class="ph ph-arrow-left"></i> Ver todos os eventos do mês</button>` : '';

            if(listaContas.length === 0 && listaSubs.length === 0) {
                container.innerHTML = `${botaoVoltar}<h4 class="cal-eventos-titulo">${titulo}</h4><p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:10px;">Nenhum evento encontrado.</p>`;
                return;
            }

            const classeAnim = animarNaCarga ? ' item-anim' : '';
            const classeAnimBadge = animarNaCarga ? ' anim-pop' : '';
            let html = `${botaoVoltar}<h4 class="cal-eventos-titulo">${titulo}</h4>`;
            let atrasoItem = 0;

            listaContas.forEach(f => {
                html += `
                <div class="cal-evento-item${classeAnim}" style="animation-delay:${atrasoItem}s">
                    <i class="ph ph-${obterIconeCategoria(f.categoria)}" style="color:var(--text-muted);"></i>
                    <span class="cal-evento-texto">
                        ${_esc(f.nome)} <strong style="color:var(--text-highlight-alt)">- R$ ${f.valor.toFixed(2)}</strong>
                        ${f.obs ? `<div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">${_esc(f.obs)}</div>` : ''}
                    </span>
                    <span class="vencimento-tag${classeAnimBadge}" style="color:white; background-color:${f.pago ? 'var(--green-success)' : 'var(--red-danger)'}">Dia ${f.vencimento} ${f.pago ? '✓' : ''}</span>
                </div>`;
                atrasoItem += 0.05;
            });

            listaSubs.forEach(s => {
                html += `
                <div class="cal-evento-item${classeAnim}" style="animation-delay:${atrasoItem}s">
                    <i class="ph ph-${obterIconeAssinatura(s.categoria)}" style="color:var(--sub-color);"></i>
                    <span class="cal-evento-texto">
                        ${_esc(s.nome)} <strong style="color:var(--sub-color)">- R$ ${(s.valor||0).toFixed(2)}</strong>
                    </span>
                    <span class="vencimento-tag${classeAnimBadge}" style="color:white; background-color:var(--sub-color)">Dia ${s.vencimento}</span>
                </div>`;
                atrasoItem += 0.05;
            });

            container.innerHTML = html;
        }

        // Volta a lista do calendário pra mostrar todos os eventos do mês (some a seleção de dia).
        function verTodosEventosDoMes() {
            diaCalendarioSelecionado = null;
            renderizarCalendario();
        }
