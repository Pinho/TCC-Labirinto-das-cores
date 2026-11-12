// ==========================================
        // LÓGICA DE VALIDAÇÃO (LIMITE DE 23 PLACAS)
        // ==========================================
        let lastValidState = { n: 19, d: 2, de: 0, p: 2, e: 0 };

        function themeChartColors() {
            const styles = getComputedStyle(document.documentElement);
            return {
                text: styles.getPropertyValue('--text-muted').trim(),
                heading: styles.getPropertyValue('--text-main').trim(),
                border: styles.getPropertyValue('--border').trim()
            };
        }

        function validarESimular() {
            let n = parseInt(document.getElementById('inNormal').value);
            let d = parseInt(document.getElementById('inDalt').value);
            let de = parseInt(document.getElementById('inDeutan').value);
            let p = parseInt(document.getElementById('inProtan').value);
            let e = parseInt(document.getElementById('inErro').value);

            // A nova regra do TCC prevê 23 salas no total.
            let total = n + d + de + p;
            let counter = document.getElementById('totalCounter');

            // Se passar de 23, reverte para o último estado válido e treme a tela
            if (total > 23) {
                document.getElementById('inNormal').value = lastValidState.n;
                document.getElementById('inDalt').value = lastValidState.d;
                document.getElementById('inDeutan').value = lastValidState.de;
                document.getElementById('inProtan').value = lastValidState.p;
                document.getElementById('inErro').value = lastValidState.e;
                
                counter.classList.add('error-shake');
                setTimeout(() => counter.classList.remove('error-shake'), 500);
                
                document.getElementById('bossSpeech').innerText = "ERRO DO SISTEMA: A soma das placas do labirinto não pode ultrapassar 23!";
                document.getElementById('bossSpeech').style.color = "red";
                return;
            }

            // Salva o estado válido e atualiza os números na UI
            lastValidState = { n, d, de, p, e };
            document.getElementById('valN').innerText = n;
            document.getElementById('valDalt').innerText = d;
            document.getElementById('valDeutan').innerText = de;
            document.getElementById('valProtan').innerText = p;
            document.getElementById('valErro').innerText = e;

            counter.innerText = `Total de Placas: ${total} / 23`;
            counter.style.borderColor = (total === 23) ? "var(--success)" : "var(--border)";
            
            // Passamos o total de erros (Tudo que não foi "Visão Normal")
            let errosTotais = d + de + p;
            simularFuzzy(n, d, de, p, e, total, errosTotais);
        }

        // ==========================================
        // NOVO MOTOR MATEMÁTICO FUZZY (MAMDANI)
        // ==========================================
        
        // Fuzzificação R/G (Escala 0 a 23 Erros Totais)
        function f_RGN(x) { return x <= 6 ? Math.max(0, (6-x)/4) : 0; }
        function f_RGM(x) { return (x >= 3 && x <= 20) ? (x <= 7 ? (x-3)/4 : (x <= 15 ? 1 : (20-x)/5)) : 0; }
        function f_RGS(x) { return x >= 16 ? Math.min(1, (x-16)/4) : 0; }

        // Fuzzificação Específica P/D (Escala 0 a 4 Erros)
        function calcPD(val) {
            let r = { N: 0, L: 0, M: 0, S: 0 };
            if (val <= 1.5) r.N = Math.max(0, (1.5 - val) / 1.5);
            if (val > 0 && val <= 2.5) { r.L = val <= 1 ? val / 1 : (2.5 - val) / 1.5; }
            if (val >= 1.5 && val <= 4) { r.M = val <= 2 ? (val - 1.5) / 0.5 : (val <= 3 ? 1 : (4 - val) / 1); }
            if (val >= 3) r.S = Math.min(1, (val - 3) / 1);
            return r;
        }

        // Mantida a tua função original de Inconsistência para a auditoria
        function obterGrauInconsistencia(err) {
            if (err <= 0) return 0.0;
            if (err === 1) return 0.33;
            if (err === 2) return 0.66;
            return Math.min(1.0, err / 10);
        }

        // ==========================================
        // FALA DO CHEFE (MANTIDA ORIGINAL, MAS ATUALIZADA)
        // ==========================================
        function gerarFalaChefe(diagnostico, tipo, pCons, total, scoreAQ) {
            let speech = document.getElementById('bossSpeech');
            speech.style.color = "#000"; // Reseta a cor de erro

            if (total < 23) {
                speech.innerText = `Aguardando conclusão do teste... (${total}/23 placas registradas)`;
                return;
            }

            if (diagnostico === "INCONSISTENTE") {
                speech.innerText = `"Notei muitas hesitações ou escolhas contraditórias no seu trajeto. A consistência foi de apenas ${pCons}%. Recomendo que faça o percurso novamente!"`;
            } else if (diagnostico === "Visão Normal") {
                speech.innerText = `"Analisei a consistência (${pCons}%) e a rota feita por você e o resultado é excelente! Seu perfil de navegação indica visão normal. Bom trabalho!"`;
            } else {
                let descTipo = "dificuldades mistas de cor";
                if (tipo === "Protanopia") descTipo = "dificuldade com tons avermelhados (Protanopia)";
                if (tipo === "Deuteranopia") descTipo = "dificuldade com tons esverdeados (Deuteranopia)";
                
                speech.innerText = `"Analisando seus dados (AQ: ${scoreAQ.toFixed(1)}), percebemos uma anomalia de grau ${diagnostico.toUpperCase()} no seu perfil. Isso sugere uma ${descTipo}. Vamos adaptar sua estação de trabalho!"`;
            }
        }

        // ==========================================
        // GRÁFICOS 2D E 3D (ATUALIZADOS COM NOVAS REGRAS)
        // ==========================================
        let fuzzyChart, barChart;

        function initCharts() {
            try {
                if (fuzzyChart) fuzzyChart.destroy();
                if (barChart) barChart.destroy();
                const colors = themeChartColors();
                Chart.defaults.color = colors.text;
                // Instancia Gráfico de Linhas (Nova Fuzzificação Mamdani R/G)
                const ctxFuzzy = document.getElementById('fuzzyChart').getContext('2d');
                const labelsX = Array.from({length: 24}, (_, i) => i);
                
                fuzzyChart = new Chart(ctxFuzzy, {
                    type: 'line',
                    data: {
                        labels: labelsX,
                        datasets: [
                            { label: 'Normal (R/G)', data: labelsX.map(x=>f_RGN(x)), borderColor: '#3b82f6', tension: 0.1 },
                            { label: 'Moderado (R/G)', data: labelsX.map(x=>f_RGM(x)), borderColor: '#f59e0b', tension: 0.1 },
                            { label: 'Severo (R/G)', data: labelsX.map(x=>f_RGS(x)), borderColor: '#ef4444', tension: 0.1 },
                            { label: 'Jogador', data: [], type: 'scatter', backgroundColor: '#fff', pointRadius: 8, pointBorderColor: '#3b82f6' }
                        ]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Funções de Pertinência Mamdani (0-23)' }, legend: { position: 'bottom' } } }
                });

                // Instancia Gráfico de Barras (Inferência de Mamdani)
                const ctxBar = document.getElementById('barChart').getContext('2d');
                barChart = new Chart(ctxBar, {
                    type: 'bar',
                    data: {
                        labels: ['Sev_P', 'Mod_P', 'Lev_P', 'Normal', 'Lev_D', 'Mod_D', 'Sev_D'],
                        datasets: [{ label: 'Grau de Ativação (μ)', data: [0,0,0,0,0,0,0], backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Ativação das Regras de Saída (0 a 1)' }, legend: { display: false } }, scales: { y: { min: 0, max: 1 } } }
                });

                renderizarSuperficies3D();
            } catch (error) {
                console.error("Erro ao carregar os gráficos.", error);
            }
        }

        // Funções Plotly 3D originais recuperadas e atualizadas
        function renderizarSuperficies3D() {
            try {
                let x_resp = Array.from({length: 24}, (_, i) => i); // Erros R/G
                let y_portas = [0, 1, 2, 3, 4]; // Erros Deutan Específicos
                let y_erros = Array.from({length: 21}, (_, i) => i);

                let z_deutan = [];
                for(let d of y_portas) {
                    let row = [];
                    for(let tot of x_resp) {
                        // Calcula o Score AQ real baseado nas regras Mamdani
                        let rgN = f_RGN(tot), rgM = f_RGM(tot), rgS = f_RGS(tot);
                        let resD = calcPD(d);
                        
                        let r_MiD = Math.max(Math.min(rgN, resD.L), Math.min(rgM, resD.L));
                        let r_MoD = Math.max(Math.min(rgM, resD.M), Math.min(rgS, resD.M), Math.min(rgM, resD.S));
                        let r_SD = Math.min(rgS, resD.S);
                        
                        let somaP = (r_MiD * -2) + (r_MoD * -5) + (r_SD * -8);
                        let somaA = r_MiD + r_MoD + r_SD;
                        
                        row.push(somaA > 0 ? somaP/somaA : 0);
                    }
                    z_deutan.push(row);
                }

                let z_cons = [];
                for(let y of y_erros) {
                    let row = [];
                    for(let x of x_resp) {
                        let c_base = 100 - (obterGrauInconsistencia(y) * 100);
                        row.push(Math.max(0, Math.min(100, c_base)));
                    }
                    z_cons.push(row);
                }

                let layoutDark = {
                    paper_bgcolor: '#0f172a', plot_bgcolor: '#0f172a',
                    font: { color: colors.text },
                    margin: { l: 0, r: 0, b: 0, t: 30 }
                };

                // Gráfico 1: Score AQ de Deuteranomalia
                Plotly.newPlot('plotDeutan', [{
                    z: z_deutan, x: x_resp, y: y_portas, type: 'surface', colorscale: 'Portland'
                }], { ...layoutDark, title: 'Matriz de Score AQ (Deuteranomalia)' });

                // Gráfico 2: Matriz de Consistência
                Plotly.newPlot('plotConsistencia', [{
                    z: z_cons, x: x_resp, y: y_erros, type: 'surface', colorscale: 'RdYlGn'
                }], { ...layoutDark, title: 'Matriz de Consistência e Auditoria' });
            } catch (error) {
                console.error("Erro ao carregar Plotly 3D.", error);
            }
        }

        // ==========================================
        // FLUXO PRINCIPAL DE SIMULAÇÃO (ATUALIZADO)
        // ==========================================
        function simularFuzzy(vNormal, vDalt, vDeutan, vProtan, err, totalUsado, errosTotais) {
            
            // 1. Auditoria de Consistência
            let pCons = Math.max(0, 100 - Math.floor(obterGrauInconsistencia(err) * 100));

            // 2. Fuzzificação Mamdani
            let rgN = f_RGN(errosTotais), rgM = f_RGM(errosTotais), rgS = f_RGS(errosTotais);
            let resP = calcPD(vProtan);
            let resD = calcPD(vDeutan);

            // 3. Inferência
            let r_SD = Math.min(rgS, resD.S);
            let r_MoD = Math.max(Math.min(rgM, resD.M), Math.min(rgS, resD.M), Math.min(rgM, resD.S));
            let r_MiD = Math.max(Math.min(rgN, resD.L), Math.min(rgM, resD.L));
            let r_N = rgN;
            let r_MiP = Math.max(Math.min(rgN, resP.L), Math.min(rgM, resP.L));
            let r_MoP = Math.max(Math.min(rgM, resP.M), Math.min(rgS, resP.M), Math.min(rgM, resP.S));
            let r_SP = Math.min(rgS, resP.S);

            // 4. Defuzzificação (Centro de Gravidade)
            let somaPesos = (r_SD * -8) + (r_MoD * -5) + (r_MiD * -2) + (r_N * 0) + (r_MiP * 2) + (r_MoP * 5) + (r_SP * 8);
            let somaAreas = r_SD + r_MoD + r_MiD + r_N + r_MiP + r_MoP + r_SP;

            let scoreAQ = 0;
            if (somaAreas > 0) scoreAQ = somaPesos / somaAreas;

            // 5. Determinar Textos e Cores
            let diagBase = "Normal";
            let colorClass = "txt-normal";

            if (scoreAQ <= -6) { diagBase = "Severo"; colorClass = "txt-severo"; }
            else if (scoreAQ <= -3) { diagBase = "Moderado"; colorClass = "txt-moderado"; }
            else if (scoreAQ < -0.5) { diagBase = "Leve"; colorClass = "txt-leve"; }
            else if (scoreAQ >= 6) { diagBase = "Severo"; colorClass = "txt-severo"; }
            else if (scoreAQ >= 3) { diagBase = "Moderado"; colorClass = "txt-moderado"; }
            else if (scoreAQ > 0.5) { diagBase = "Leve"; colorClass = "txt-leve"; }

            let tipo = "Visão Comum";
            if (diagBase !== "Normal") {
                if (scoreAQ > 0) tipo = "Protanopia";
                else if (scoreAQ < 0) tipo = "Deuteranopia";
            }

            let diagnosticoFinal = diagBase === "Normal" ? "Visão Normal" : `${diagBase}`;
            if (pCons < 30) {
                diagnosticoFinal = "INCONSISTENTE";
                tipo = "Sessão Anulada";
                colorClass = "txt-inc";
            }

            // Atualiza UI
            document.getElementById('outDiagnostico').innerText = (diagBase === "Normal" || diagnosticoFinal === "INCONSISTENTE") ? diagnosticoFinal : scoreAQ.toFixed(2);
            document.getElementById('outDiagnostico').className = `metric-value ${colorClass}`;
            document.getElementById('outConsistencia').innerText = `${pCons}%`;
            document.getElementById('outConsistencia').style.color = pCons < 50 ? 'var(--danger)' : 'var(--success)';
            document.getElementById('outTipo').innerText = tipo;

            gerarFalaChefe(diagnosticoFinal, tipo, pCons, totalUsado, scoreAQ);

            // Atualiza os Gráficos 2D
            if (fuzzyChart && barChart) {
                let maxAtivacao = Math.max(rgN, rgM, rgS);
                fuzzyChart.data.datasets[3].data = (pCons >= 30) ? [{x: errosTotais, y: maxAtivacao}] : [];
                fuzzyChart.update();
                
                barChart.data.datasets[0].data = [r_SP, r_MoP, r_MiP, r_N, r_MiD, r_MoD, r_SD];
                barChart.update();
            }
        }

        window.addEventListener('load', function() {
            initCharts();
            validarESimular();
            document.querySelectorAll('input[type="range"]').forEach((input) => {
                input.addEventListener('input', validarESimular);
            });

            document.addEventListener('themechange', function() {
                initCharts();
                validarESimular();
            });
        });
