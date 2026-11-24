# FitTrack

**Plataforma de Organização de Treinos e Monitoramento de Desempenho**

Protótipo de aplicação web (SPA) para organizar fichas de treino de musculação, registrar a carga e as repetições de cada sessão e acompanhar a evolução por exercício. Desenvolvido como Projeto Integrador de Programação Web (Tecnologia em Análise e Desenvolvimento de Sistemas, UNISA).

Os dados ficam no `localStorage` do navegador: não há servidor nem cadastro.

## Funcionalidades

- **Dashboard:** indicadores (fichas, treinos no mês, último treino), gráfico de carga média por treino e últimas atividades.
- **Minhas fichas:** criar, editar e excluir fichas e exercícios; reordenar exercícios.
- **Executar treino:** registrar carga e repetições por exercício, com validação dos dados.
- **Minha evolução:** gráfico por exercício, maior carga, tabela de registros e comparação entre dois registros.

Na primeira abertura, o sistema carrega 3 fichas e 8 treinos de demonstração.

## Tecnologias

HTML5, CSS3, JavaScript (módulos ES), [Vite](https://vite.dev/) 5, [Bootstrap](https://getbootstrap.com/) 5.3.3, [Bootstrap Icons](https://icons.getbootstrap.com/) 1.11.3, [Chart.js](https://www.chartjs.org/) 4.4.3 e fonte Inter (Google Fonts). Bootstrap, Bootstrap Icons e Chart.js são carregados por CDN (jsDelivr), então é preciso ter internet na primeira abertura.

## Como executar

Requisito: [Node.js](https://nodejs.org/) instalado.

```bash
npm install      # instala o Vite
npm run dev      # servidor de desenvolvimento
npm run build    # gera a versão final em dist/
npm run preview  # visualiza a versão final
```

## Estrutura

```
fittrack/
├── index.html            estrutura das telas e dos modais
├── package.json          dependências e scripts
├── testes/
│   ├── fittrack-testes.cjs   testes funcionais automatizados
│   └── log-dos-testes.txt    saída da última execução (71/71 aprovadas)
└── src/
    ├── main.js           inicialização e navegação entre telas
    ├── storage.js        leitura, gravação e dados de demonstração
    ├── utils.js          datas, validação, mensagens e confirmação
    ├── style.css         identidade visual e responsividade
    └── screens/
        ├── dashboard.js
        ├── fichas.js
        ├── treino.js
        └── evolucao.js
```

## Testes

O script `testes/fittrack-testes.cjs` usa [Playwright](https://playwright.dev/) com Chromium. Nele, Bootstrap e Chart.js são substituídos por versões simplificadas que só registram as chamadas feitas a eles. Por isso, os testes verificam a lógica (dados gravados, validações, navegação, elementos gerados e valores enviados aos gráficos) e **não** a aparência nem o desenho real dos gráficos.

```bash
npm install --no-save playwright
npx playwright install chromium
node testes/fittrack-testes.cjs .
```

O último argumento (`.`) é a pasta do projeto, que deve ser a raiz do repositório.
