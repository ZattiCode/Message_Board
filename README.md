# Guestbook Full Stack (Express + SQLite + Vanilla JS)

Projeto simples para portfólio mostrando **front-end + back-end + banco**.

## Stack
- Back-end: Node.js + Express
- Banco: SQLite (arquivo `guestbook.db` criado automaticamente)
- Front-end: HTML + CSS + JavaScript (fetch API)

## Como rodar
1. **Instale as dependências**:
   ```bash
   cd backend
   npm install
   ```
2. **Inicie o servidor** (isso também serve os arquivos do front):
   ```bash
   npm start
   ```
   Acesse: http://localhost:3000

## Endpoints
- `GET /api/health` → status
- `GET /api/messages` → lista mensagens
- `POST /api/messages` → cria mensagem `{ name, message }`
- `DELETE /api/messages/:id` → apaga mensagem

## Estrutura
```
/backend
  server.js
  package.json
/frontend
  index.html
  main.js
  styles.css
```

## Deploy (sugestão)
- Suba o repositório no GitHub.
- Hospede o servidor no Render/Fly.io. Como é app Node simples, basta apontar para `npm start` com Node 18+.
- O front já é servido pelo próprio Express (rota estática).

## Observações
- O banco é SQLite (arquivo local). Para produção, troque por Postgres facilmente.
- Segurança básica apenas para demo (sem autenticação).
- Código em **ES Modules**.
