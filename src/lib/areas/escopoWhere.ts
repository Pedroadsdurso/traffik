/**
 * O `where` de uma área — **sem importar o banco**, e é isso que o arquivo é.
 *
 * > ### 🔴 POR QUE ISTO É UM ARQUIVO PRÓPRIO
 * >
 * > As duas linhas abaixo moravam dentro do `escopoDeConfig`, que importa o
 * > `prisma`. Um `import` daquele módulo **abre conexão na carga** (`prisma.ts`
 * > lança se não houver `DATABASE_URL`), então a assimetria abaixo não tinha
 * > como ser exercida por teste puro nenhum — e ela é a coisa mais fácil desta
 * > base de quebrar sem ninguém ver.
 *
 * | área | recorte | efeito |
 * |---|---|---|
 * | **Principal** (`isDefault`) | `OR [ id , NULL ]` | **catch-all** — leva junto tudo que não tem dono |
 * | secundária | `workspaceId = id` | estrito |
 *
 * ⚠️ **É um MOVE**: nem uma vírgula do que era produzido mudou.
 *
 * ⚠️ E é por causa da assimetria que uma asserção de *"trocar de área muda a
 * lista"* **passa sem exercer nada** com uma fixture de um item só: indo de uma
 * área secundária para a Principal a lista só CRESCE, e no sentido inverso ela
 * pode não encolher se não houver órfão. A fixture precisa de três: um de cada
 * área e um sem dono.
 */

/** `where` do Prisma para listar o que pertence a uma área. */
export type WhereDaArea = { workspaceId: string } | { OR: [{ workspaceId: string }, { workspaceId: null }] };

export function whereDaArea(areaId: string, ehPrincipal: boolean): WhereDaArea {
  return ehPrincipal ? { OR: [{ workspaceId: areaId }, { workspaceId: null }] } : { workspaceId: areaId };
}
