let dadosGlobais = [];
    let chartTemposInst, chartFuzzyInst;

    function themeColors() {
        const styles = getComputedStyle(document.documentElement);
        return {
            background: styles.getPropertyValue('--bg').trim(),
            text: styles.getPropertyValue('--muted').trim(),
            heading: styles.getPropertyValue('--heading').trim(),
            border: styles.getPropertyValue('--border').trim()
        };
    }

function processarDados() {
        const textoRaw = document.getElementById('csvInput').value.trim();
        if (!textoRaw) return alert("Cole os dados no campo de texto.");

        const linhas = textoRaw.split(/\r?\n/);
        dadosGlobais = [];

        for (let linha of linhas) {
            linha = linha.trim();
            if (!linha) continue;

            const cols = linha.split(';').map(coluna => coluna.trim());
            
            // Ignora cabeçalhos ou linhas corrompidas curtas demais
            if (cols.length < 15 || (cols[1] && cols[1].includes("UserId"))) continue;

            const nomeLimpo = cols[0].split(/\s+/).pop();
            if (!nomeLimpo || !cols[1]) continue;
            
            // Leitura de trás para frente (garante que funciona com CSV antigo e novo)
            let indiceData = cols.length - 1;
            let indiceTrajeto = cols.length - 2;

            let jsonTrajetoStr = cols[indiceTrajeto] || "";
            const inicioJson = jsonTrajetoStr.indexOf('[');
            const limiteFinalTrajeto = jsonTrajetoStr.lastIndexOf(']');
            if (inicioJson !== -1 && limiteFinalTrajeto > inicioJson) {
                jsonTrajetoStr = jsonTrajetoStr.substring(inicioJson, limiteFinalTrajeto + 1);
            }

            let trajeto = [];
            try {
                const trajetoParsed = JSON.parse(jsonTrajetoStr || "[]");
                if (Array.isArray(trajetoParsed)) {
                    trajeto = trajetoParsed.filter(p =>
                        p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z))
                    );
                }
            } catch (e) {
                console.warn(`Trajeto inválido ignorado para ${nomeLimpo}.`, e);
            }

            let tempos = {};
            let salasCompletadas = 0;

            // Pega tudo que estiver entre o Tempo Total (11) e o Trajeto JSON (indiceTrajeto)
            for (let i = 12; i < indiceTrajeto; i++) {
                let tempoSala = parseFloat(String(cols[i] || "").replace(',', '.')) || 0;
                let numSala = String(i - 11).padStart(2, '0');
                tempos["Sala_" + numSala] = tempoSala; 
                
                if (tempoSala > 0) salasCompletadas++;
            }

            // Identificação da Versão do Modelo
            let versaoModelo = "";
            
            // REGRA NOVA: Se não tem coordenadas e todos os tempos são zero = Teste Antigo Completo (Sessões de Junho)
            if (trajeto.length === 0 && salasCompletadas === 0) {
                versaoModelo = "12_Salas";
            }
            // Tolerância para testes antigos que registraram tempo
            else if (salasCompletadas >= 10 && salasCompletadas <= 12 && (!tempos["Sala_13"] || tempos["Sala_13"] === 0)) {
                versaoModelo = "12_Salas";
            } 
            // Tolerância para testes do modelo novo
            else if (salasCompletadas >= 20 && salasCompletadas <= 24) {
                versaoModelo = "24_Salas";
            } 
            // Abortados (incompletos de verdade que não batem com a regra acima) são descartados
            else {
                continue; 
            }

            let dataStr = cols[indiceData] ? cols[indiceData].split(/\s+-\s+/)[0].trim() : "";
            const parsePercentual = valor => parseFloat(String(valor || "").replace('%', '').replace(',', '.')) || 0;

            try {
                // Limpa os tempos do modelo antigo para não poluir a matriz (deixa só as 12 primeiras)
                let temposLimpos = {};
                Object.keys(tempos).forEach(k => {
                    if (versaoModelo === "12_Salas" && parseInt(k.replace("Sala_", "")) > 12) return;
                    temposLimpos[k] = tempos[k];
                });

                dadosGlobais.push({
                    nome: nomeLimpo, id: cols[1].trim(), diagnostico: cols[2].trim(), tipo: cols[3].trim(),
                    certeza: parsePercentual(cols[4]), pctNormal: parsePercentual(cols[5]), pctLeve: parsePercentual(cols[6]),
                    pctMod: parsePercentual(cols[7]), pctSev: parsePercentual(cols[8]), pctConsistencia: parsePercentual(cols[9]),
                    data: dataStr, tempos: temposLimpos, trajeto: trajeto, versao: versaoModelo, qtdSalas: salasCompletadas
                });
            } catch (e) {
                console.warn(`Linha de telemetria ignorada para ${nomeLimpo}:`, e);
            }
        }

        if (dadosGlobais.length === 0) return alert("Nenhum dado válido completo foi encontrado.");

        popularSeletor();
        
        document.getElementById('kpiGrid').classList.remove('is-hidden');
        document.getElementById('selectorSection').style.display = 'block';
        document.getElementById('mainDashboard').style.display = 'grid';
        
        atualizarDashboards(); 
    }

    function atualizarKPIs(dadosSelecionados) {
        let anomalias = 0; let inconsistentes = 0;
        let somaTempoGlobal = 0; let testesComTempo = 0;

        dadosSelecionados.forEach(d => {
            if (d.diagnostico === "INCONSISTENTE" || d.pctConsistencia < 50) inconsistentes++;
            else if (d.diagnostico !== "Visão Normal") anomalias++;

            let valoresTempo = Object.values(d.tempos);
            if (valoresTempo.length > 0) {
                somaTempoGlobal += valoresTempo.reduce((a, b) => a + b, 0);
                testesComTempo++;
            }
        });

        let tempoMedioStr = "-";
        if (testesComTempo > 0) {
            let mediaSegundos = somaTempoGlobal / testesComTempo;
            let minutos = Math.floor(mediaSegundos / 60);
            let segundos = Math.round(mediaSegundos % 60);
            tempoMedioStr = minutos > 0 ? `${minutos}m ${segundos}s` : `${segundos}s`;
        }

        document.getElementById('kpiTotal').innerText = dadosSelecionados.length;
        document.getElementById('kpiTempoGlobal').innerText = tempoMedioStr;
        document.getElementById('kpiAnomalias').innerText = anomalias;
        document.getElementById('kpiInconsistentes').innerText = inconsistentes;
    }

    function popularSeletor() {
        const seletor = document.getElementById('runSelector');
        seletor.innerHTML = ''; 

        // 1. Visões Globais
        seletor.innerHTML += `<optgroup label="🌐 VISÕES GLOBAIS">
            <option value="GLOBAL_ALL">População Total (Misturar 12 e 24 Salas)</option>
            <option value="GLOBAL_12">Apenas Testes do Modelo Antigo (12 Salas)</option>
            <option value="GLOBAL_24">Apenas Testes do Modelo Novo (24 Salas)</option>
        </optgroup>`;

        // 2. Visões por Usuário
        const usuariosUnicos = [...new Set(dadosGlobais.map(d => d.nome))].sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));
        usuariosUnicos.forEach(user => {
            let tem12 = dadosGlobais.some(d => d.nome === user && d.versao === "12_Salas");
            let tem24 = dadosGlobais.some(d => d.nome === user && d.versao === "24_Salas");
            
            let htmlUser = `<optgroup label="👤 MÉDIAS DO USUÁRIO: ${user}">
                <option value="USER_ALL|${user}">Todos os Testes de ${user}</option>`;
            if (tem12) htmlUser += `<option value="USER_12|${user}">Testes Antigos de ${user} (12 Salas)</option>`;
            if (tem24) htmlUser += `<option value="USER_24|${user}">Testes Novos de ${user} (24 Salas)</option>`;
            htmlUser += `</optgroup>`;
            
            seletor.innerHTML += htmlUser;
        });

        // 3. Testes Individuais
        let optGroupInd = `<optgroup label="🕹️ SESSÕES INDIVIDUAIS ESPECÍFICAS">`;
        [...dadosGlobais].reverse().forEach((run, index) => {
            const realIndex = dadosGlobais.length - 1 - index;
            optGroupInd += `<option value="IND|${realIndex}">[${run.versao}] ${run.data} | ${run.nome} | Diag: ${run.diagnostico}</option>`;
        });
        optGroupInd += `</optgroup>`;
        
        seletor.innerHTML += optGroupInd;
    }

    function atualizarDashboards() {
        const valor = document.getElementById('runSelector').value;
        const badges = document.querySelectorAll('.badge');
        
        let dadosFiltrados = [];
        let nomeBadge = "";
        let ehAgrupamento = true;

        // Lógica de Separação de Dados
        if (valor === "GLOBAL_ALL") {
            dadosFiltrados = dadosGlobais; nomeBadge = "POPULAÇÃO GERAL";
        } else if (valor === "GLOBAL_12") {
            dadosFiltrados = dadosGlobais.filter(d => d.versao === "12_Salas"); nomeBadge = "MODELO ANTIGO (12 S)";
        } else if (valor === "GLOBAL_24") {
            dadosFiltrados = dadosGlobais.filter(d => d.versao === "24_Salas"); nomeBadge = "MODELO NOVO (24 S)";
        } else if (valor.startsWith("USER_ALL|")) {
            let u = valor.split("|")[1];
            dadosFiltrados = dadosGlobais.filter(d => d.nome.localeCompare(u, undefined, {sensitivity: 'base'}) === 0); nomeBadge = `JOGADOR: ${u} (TUDO)`;
        } else if (valor.startsWith("USER_12|")) {
            let u = valor.split("|")[1];
            dadosFiltrados = dadosGlobais.filter(d => d.nome.localeCompare(u, undefined, {sensitivity: 'base'}) === 0 && d.versao === "12_Salas"); nomeBadge = `JOGADOR: ${u} (12 S)`;
        } else if (valor.startsWith("USER_24|")) {
            let u = valor.split("|")[1];
            dadosFiltrados = dadosGlobais.filter(d => d.nome.localeCompare(u, undefined, {sensitivity: 'base'}) === 0 && d.versao === "24_Salas"); nomeBadge = `JOGADOR: ${u} (24 S)`;
        } else if (valor.startsWith("IND|")) {
            let idx = parseInt(valor.split("|")[1]);
            dadosFiltrados = [dadosGlobais[idx]]; nomeBadge = "SESSÃO ÚNICA";
            ehAgrupamento = false;
        }

        badges.forEach(b => { 
            b.innerText = nomeBadge; 
            b.style.backgroundColor = ehAgrupamento ? "#3b82f6" : "#8b5cf6"; 
        });

        // Atualiza os KPIs superiores para refletirem os dados da seleção atual
        atualizarKPIs(dadosFiltrados);

        // Uma única sessão deve preservar todos os valores reais, inclusive salas com tempo zero.
        // Médias só são aplicadas quando há mais de um registro selecionado.
        const exibirSessaoIndividual = dadosFiltrados.length === 1;
        if(!exibirSessaoIndividual && (ehAgrupamento || dadosFiltrados.length > 1)) {
            renderizarMapaGlobal(dadosFiltrados);
            calcularERenderizarTemposGlobal(dadosFiltrados);
            renderizarRadarFuzzyGlobal(dadosFiltrados);
        } else {
            renderizarMapaIndividual(dadosFiltrados[0]);
            calcularERenderizarTemposIndividual(dadosFiltrados[0]);
            renderizarRadarFuzzyIndividual(dadosFiltrados[0]);
        }
    }

    // ==========================================
    // 1. PLOTLY: MAPA DE CALOR
    // ==========================================
    function renderizarMapaGlobal(dadosSelecionados) {
        let traces = [];
        let hasData = false;

        dadosSelecionados.forEach((run, i) => {
            if (run.trajeto && run.trajeto.length > 0) {
                hasData = true;
                const xCoords = run.trajeto.map(p => p.x);
                const zCoords = run.trajeto.map(p => p.z);
                
                traces.push({
                    x: xCoords, y: zCoords, mode: 'lines',
                    line: { color: 'rgba(59, 130, 246, 0.3)', width: 2, shape: 'spline' },
                    hoverinfo: 'skip', showlegend: false
                });

                if (traces.length === 1) {
                    traces.push({
                        x: [xCoords[0]], y: [zCoords[0]], mode: 'markers+text', name: 'Início', text: ['START'], textposition: 'bottom center',
                        marker: { size: 14, color: '#10b981', symbol: 'square' }, showlegend: false
                    });
                    traces.push({
                        x: [xCoords[xCoords.length - 1]], y: [zCoords[zCoords.length - 1]], mode: 'markers+text', name: 'Fim', text: ['MONITOR'], textposition: 'top center',
                        marker: { size: 16, color: '#ef4444', symbol: 'star' }, showlegend: false
                    });
                }
            }
        });

        if (!hasData) {
            document.getElementById('plotMapa').innerHTML = "<div style='color: #ef4444; text-align: center; padding-top: 200px;'>Nenhuma telemetria espacial neste grupo de dados.</div>";
            return;
        }

        const colors = themeColors();
        const layout = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: colors.background, font: { color: colors.text }, xaxis: { title: 'Eixo X' }, yaxis: { title: 'Eixo Z', autorange: 'reversed' }, margin: { t: 10, b: 40, l: 40, r: 10 }, showlegend: false };
        Plotly.newPlot('plotMapa', traces, layout);
    }

    function renderizarMapaIndividual(sessao) {
        if (!sessao.trajeto || sessao.trajeto.length === 0) {
            document.getElementById('plotMapa').innerHTML = "<div style='color: #ef4444; text-align: center; padding-top: 200px;'>Sem dados espaciais para este paciente.</div>";
            return;
        }
        const xCoords = sessao.trajeto.map(p => p.x); const zCoords = sessao.trajeto.map(p => p.z);
        const tracoLinha = { x: xCoords, y: zCoords, mode: 'lines+markers', line: { color: '#8b5cf6', width: 2, shape: 'spline' }, marker: { size: 4, color: '#c4b5fd' }, name: 'Trajeto' };
        const colors = themeColors();
        const layout = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: colors.background, font: { color: colors.text }, xaxis: { title: 'Eixo X' }, yaxis: { title: 'Eixo Z', autorange: 'reversed' }, margin: { t: 10, b: 40, l: 40, r: 10 }};
        Plotly.newPlot('plotMapa', [tracoLinha], layout);
    }

    // ==========================================
    // 2. CHART.JS: TEMPOS
    // ==========================================
    function calcularERenderizarTemposGlobal(dadosSelecionados) {
        let somaSalas = {}; let contagemSalas = {};
        
        dadosSelecionados.forEach(run => {
            Object.keys(run.tempos).forEach(sala => {
                let v = run.tempos[sala];
                if (v > 0) {
                    somaSalas[sala] = (somaSalas[sala] || 0) + v;
                    contagemSalas[sala] = (contagemSalas[sala] || 0) + 1;
                }
            });
        });

        const salasKeys = Object.keys(somaSalas).sort((a, b) => parseInt(a.replace('Sala_', '')) - parseInt(b.replace('Sala_', '')));
        const mediasRaw = salasKeys.map(k => parseFloat((somaSalas[k] / contagemSalas[k]).toFixed(2)));

        atualizarInterfaceTempos(salasKeys, mediasRaw, 'Média (s)');
    }

    function calcularERenderizarTemposIndividual(sessao) {
        const salasKeys = Object.keys(sessao.tempos).sort((a, b) => parseInt(a.replace('Sala_', '')) - parseInt(b.replace('Sala_', '')));
        const valoresRaw = salasKeys.map(k => sessao.tempos[k]);
        atualizarInterfaceTempos(salasKeys, valoresRaw, 'Segundos na Sala');
    }

    function atualizarInterfaceTempos(salasKeys, valoresArray, legenda) {
        const valoresValidos = valoresArray.filter(v => v > 0);
        let tTotal = 0, tMedia = 0, tDesvio = 0, maxVal = 0, minVal = Infinity;
        let salaMax = "-", salaMin = "-";

        if (valoresValidos.length > 0) {
            tTotal = valoresValidos.reduce((a, b) => a + b, 0);
            tMedia = tTotal / valoresValidos.length;
            let variancia = valoresValidos.reduce((a, b) => a + Math.pow(b - tMedia, 2), 0) / valoresValidos.length;
            tDesvio = Math.sqrt(variancia);

            salasKeys.forEach((k, i) => {
                let v = valoresArray[i];
                if (v > 0) {
                    if (v > maxVal) { maxVal = v; salaMax = k.replace('Sala_', 'Fase '); }
                    if (v < minVal) { minVal = v; salaMin = k.replace('Sala_', 'Fase '); }
                }
            });
        }

        document.getElementById('tTotal').innerText = tTotal > 0 ? `${tTotal.toFixed(1)}s` : "N/A";
        document.getElementById('tMedia').innerText = tMedia > 0 ? `${tMedia.toFixed(2)}s` : "N/A";
        document.getElementById('tDesvio').innerText = tDesvio > 0 ? `± ${tDesvio.toFixed(2)}s` : "N/A";
        document.getElementById('tLenta').innerText = maxVal > 0 ? `${salaMax} (${maxVal}s)` : "N/A";
        document.getElementById('tRapida').innerText = minVal !== Infinity ? `${salaMin} (${minVal}s)` : "N/A";

        const ctx = document.getElementById('chartTempos').getContext('2d');
        const colors = themeColors();
        if (chartTemposInst) chartTemposInst.destroy();

        const labels = salasKeys.map(k => k.replace('_', ' '));
        const linhaMedia = Array(labels.length).fill(tMedia);
        if(valoresArray.length === 0) { labels.push("Sem Dados"); valoresArray.push(0); linhaMedia.push(0); }

        chartTemposInst = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { type: 'line', label: 'Linha de Tendência', data: linhaMedia, borderColor: '#8b5cf6', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false },
                    { type: 'bar', label: legenda, data: valoresArray, backgroundColor: valoresArray.map(v => v === maxVal ? '#ef4444' : (v === minVal ? '#10b981' : '#3b82f6')), borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: colors.text } } }, scales: { y: { beginAtZero: true, grid: { color: colors.border }, ticks: { color: colors.text } }, x: { grid: { display: false }, ticks: { color: colors.text } } } }
        });
    }

    // ==========================================
    // 3. CHART.JS: RADAR FUZZY
    // ==========================================
    function renderizarRadarFuzzyGlobal(dadosSelecionados) {
        let tN = 0, tL = 0, tM = 0, tS = 0;
        
        // Calcula a média exata do grupo atual (12 salas, 24 salas ou usuário específico)
        dadosSelecionados.forEach(r => { 
            tN += r.pctNormal; 
            tL += r.pctLeve; 
            tM += r.pctMod; 
            tS += r.pctSev; 
        });
        
        let total = dadosSelecionados.length || 1;
        
        desenharRadar([
            Math.round(tN/total), 
            Math.round(tL/total), 
            Math.round(tM/total), 
            Math.round(tS/total)
        ], 'rgba(59, 130, 246, 0.2)', '#3b82f6');
    }

    function renderizarRadarFuzzyIndividual(sessao) {
        desenharRadar([sessao.pctNormal, sessao.pctLeve, sessao.pctMod, sessao.pctSev], 'rgba(139, 92, 246, 0.2)', '#8b5cf6');
    }

    function desenharRadar(dadosGrafico, corFundo, corBorda) {
        const ctx = document.getElementById('chartFuzzy').getContext('2d');
        if (chartFuzzyInst) chartFuzzyInst.destroy();
        const colors = themeColors();
        Chart.defaults.color = colors.text;

        chartFuzzyInst = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Visão Normal', 'Grau Leve', 'Grau Moderado', 'Grau Severo'],
                datasets: [{ label: 'Média de Pertinência (%)', data: dadosGrafico, backgroundColor: corFundo, borderColor: corBorda, pointBackgroundColor: '#fff', pointBorderColor: corBorda, borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: colors.text } } }, scales: { r: { angleLines: { color: colors.border }, grid: { color: colors.border }, pointLabels: { color: colors.heading, font: { size: 13, weight: 'bold' } }, ticks: { display: false, min: 0, max: 100 } } } }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('processDataButton').addEventListener('click', processarDados);
        document.getElementById('runSelector').addEventListener('change', atualizarDashboards);

        const campoDados = document.getElementById('csvInput');
        fetch('../data/dadosTCC.txt')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Não foi possível carregar a telemetria (${response.status}).`);
                }
                return response.text();
            })
            .then(texto => {
                if (!campoDados.value.trim()) {
                    campoDados.value = texto;
                    processarDados();
                }
            })
            .catch(error => {
                console.info('Carregamento automático indisponível. Use a entrada manual de telemetria.', error);
            });
    });

    document.addEventListener('themechange', () => {
        if (dadosGlobais.length > 0) atualizarDashboards();
    });
