# Banco, migrations e scripts que escrevem

> Complementa o que está no CLAUDE.md (dois bancos, ordem de deploy,
> `guard-db.mjs`). Aqui ficam os bugs que só apareceram ao trocar de banco.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🐛 Quatro bugs que só apareceram ao trocar de banco (29/07/2026)

Rodar contra um banco **vazio** e com **sessão de outro banco** expôs coisas que
o ambiente único escondia. Ficam registrados porque todos voltam a morder quem
trocar a `DATABASE_URL` de novo.

### 1. `garantirAreaPrincipal` estourava FK em corrida

O layout dispara ~12 leituras em `Promise.all` e várias passam por
`filtrosDaArea` → `garantirAreaPrincipal`. Com `create` dentro de `try/catch`, a
perdedora batia no índice parcial único, caía no `catch` e lia a linha da
vencedora — que **ainda não tinha commitado**. O erro real era o
`findFirstOrThrow` do catch, e o `catch` vazio escondia a causa.

Hoje é **`createMany({ skipDuplicates: true })`**: o `ON CONFLICT DO NOTHING`
resolve a corrida no banco (a perdedora **espera** o commit da vencedora e
segue). Sem `try/catch`, então nenhum erro de verdade fica escondido.

> ⚠️ **Não troque de volta para `create` + `catch`.** O padrão certo aqui é o
> mesmo do upsert monotônico de vendas e da trava do auto-sync: **quem decide o
> vencedor é o banco.**

### 2. Sessão órfã derrubava o app inteiro com 500

O callback `session` resolvia o id pelo e-mail e, **quando o e-mail não existia
neste banco**, caía no `token.sub` — um id fantasma do banco anterior. O guard
deixava passar e a primeira escrita estourava
`Foreign key constraint violated`, com a tela em 500 e nenhuma pista.

Agora e-mail sem usuário correspondente **remove o id da sessão**, e o guard
(`session?.user?.id`) manda para o login. Sessão sem usuário real se comporta
como "não logado" — que é a leitura correta depois de trocar de banco.

### 3. `ERR_TOO_MANY_REDIRECTS` entre `/dashboard` e `/login`

Consequência do #2: o guard passou a exigir `user.id`, mas `login/page.tsx` e
`signup/page.tsx` ainda faziam `if (await auth())`. A sessão órfã tem `user` sem
`id` — dashboard mandava para o login, login mandava de volta, em loop.

> ⚠️ **As duas pontas precisam do MESMO critério de "está logado".** Ao mudar o
> guard, mude também quem redireciona no sentido contrário.

### 4. `<script>` cru no `RootLayout`

O anti-FOUC do tema era uma tag `<script>` escrita como elemento React, e o
console avisava: *"Scripts inside React components are never executed when
rendering on the client"* — literal, numa navegação pelo cliente a tag entra via
`innerHTML` e o navegador não a executa. Virou **`next/script` com
`strategy="beforeInteractive"`**, que é o que a documentação local do Next manda
(`node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md`) e
que exige estar no layout raiz.
