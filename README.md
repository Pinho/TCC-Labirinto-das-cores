# TCC - Labirinto das Cores

Site do projeto de análise de percepção de cores com simulação fuzzy e visualização da telemetria das sessões.

## Estrutura

```text
.
├── index.html                 # Página inicial e ponto de entrada do site
├── assets/
│   ├── css/                   # Folhas de estilo das páginas
│   └── js/                    # Lógica de interação, gráficos e tema
├── data/
│   └── dadosTCC.txt           # Telemetria usada no dashboard
└── pages/
    ├── simulacao.html         # Simulação do motor Fuzzy Mamdani
    └── analise-dados.html     # Dashboard de análise da telemetria
```

## Como executar

Abra o arquivo `index.html` em um navegador ou sirva a raiz do projeto com
um servidor HTTP local. As páginas usam Chart.js e Plotly pelo CDN, portanto
precisam de acesso à internet para renderizar os gráficos.

As páginas também podem ser abertas diretamente pelos links da página inicial.
Quando executado por um servidor HTTP, o dashboard carrega automaticamente a
telemetria disponível em `data/dadosTCC.txt`. Também é possível colar outro
output manualmente no campo de entrada.

## Tema claro e escuro

Use o botão `Modo claro` ou `Modo escuro` no topo das páginas para alternar o
tema. A escolha fica salva no navegador e é compartilhada entre a página
inicial, a simulação e a análise de dados. O modo claro foi incluído para
facilitar capturas de tela e imagens para o TCC.
