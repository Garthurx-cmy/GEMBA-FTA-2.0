# Relatório de Auditoria de Consumo do Firestore

Este documento apresenta a auditoria de consumo e otimização do Firestore para o sistema **GEMBA FTA**, garantindo que a aplicação opere de maneira sustentável dentro dos limites de cota do plano gratuito **Firebase Spark**.

---

## 1. Diagnóstico do Consumo Excessivo (Antes)

Anteriormente, o sistema realizou milhares de leituras e gravações em um curto período:
- **51 mil leituras**
- **7 mil gravações**
- **8,3 mil conexões em tempo real**

### Identificação de Gargalos:
1. **Listeners Globais Ilimitados**: O serviço `DBService` registrava listeners em tempo real (`onSnapshot`) sobre toda a coleção de `inspections` e `notifications`. Conforme o banco crescia, cada nova inspeção adicionada acionava downloads completos do histórico de todos os usuários conectados.
2. **Consultas sem Limites**: Telas de Histórico e Relatórios carregavam em memória todas as inspeções do banco de dados, resultando em consumo volumoso a cada acesso.
3. **Persistência Redundante**: Eventos de renderização podiam recriar ouvintes devido a dependências instáveis ou loops de atualizações de estados em React.

---

## 2. Plano de Redução e Estrutura de Listeners (Depois)

Implementamos uma arquitetura centrada em **Consultas sob Demanda** e **Sincronização Limitada**, reduzindo drasticamente o consumo de banda e leitura.

### Quadro Geral de Listeners:

| Recurso / Coleção | Tipo de Listener (Antes) | Tipo de Sincronização (Depois) | Limite / Filtro | Justificativa |
| :--- | :--- | :--- | :--- | :--- |
| **inspections** | `onSnapshot` (Ilimitado) | `onSnapshot` (Limitado) | `limit(50)` ordenado por Data | Sincroniza em tempo real apenas as 50 inspeções mais recentes para alimentar o Painel Principal (Dashboard), Metas e Farol. |
| **notifications** | `onSnapshot` (Ilimitado) | `onSnapshot` (Limitado) | `limit(20)` ordenado por Data | Mantém o centro de notificações atualizado em tempo real limitado às últimas 20 mensagens. |
| **Histórico** | `onSnapshot` (Ilimitado) | Consulta sob Demanda (`getDocs`) | `limit(25)` + `startAfter` | Sem listeners persistentes. Busca em lote exatamente de 25 em 25 registros usando ponteiros de cursor. |
| **Relatórios** | `onSnapshot` (Ilimitado) | Consulta sob Demanda (`getDocs`) | `limit(100)` sob filtros | Sincronização inativa por padrão. Busca documentos no banco apenas quando filtros estruturais são aplicados. |
| **supervisors** | `onSnapshot` | `onSnapshot` | Sem limite (tamanho desprezível) | Mantido em tempo real para sincronizar metadados ativos de supervisores. |
| **areas** | `onSnapshot` | `onSnapshot` | Sem limite (tamanho desprezível) | Mantido em tempo real para sincronizar metadados ativos de localidades. |
| **contracts** | `onSnapshot` | `onSnapshot` | Sem limite (tamanho desprezível) | Mantido em tempo real para sincronizar metadados de contratos. |

---

## 3. Otimizações de Desempenho e Recursos Implementados

### 1. Paginação Inteligente no Histórico (`HistoricoView`)
* Implementamos paginação cursorizada com `startAfter` e `limit(25)`.
* O Histórico agora faz consultas parciais e sequenciais, reduzindo as leituras ao mínimo essencial.
* Adicionamos botões de navegação **Anterior** e **Próximo** perfeitamente estilizados de acordo com a identidade visual do sistema.
* Sincronização de Estado: O componente escuta o evento global `"gemba_fta_db_update"` do app para disparar recargas sob demanda somente quando ocorrerem mutações locais (criação, edição ou exclusão), garantindo dados sempre atualizados sem dependência de ouvintes perpétuos.

### 2. Filtro sob Demanda nos Relatórios (`RelatoriosView`)
* Reduzimos a carga inicial da aba de relatórios para apenas os 50 registros mais recentes em cache.
* Conexão Inteligente: Assim que qualquer filtro (Supervisor, Área, Tipo, Severidade, etc.) é selecionado, um efeito com **Debounce de 350ms** realiza uma consulta direcionada ao Firestore, baixando apenas os documentos correspondentes.
* Para visualização de relatórios individuais via links externos ou atalhos do dashboard, criamos a busca focada de único documento por ID (`dbService.getInspectionById`), consumindo **exatamente 1 leitura**.

### 3. Mecanismo de Fallback Seguro de Índices
* Consultas combinadas com ordenação no Firestore requerem a criação manual de índices compostos no console do Firebase. 
* Para mitigar travamentos ou interrupções caso o console não tenha esses índices criados no plano Spark, implementamos um **mecanismo de fallback silencioso**. Em caso de falha de índice composto, o sistema busca os dados ordenados por data e executa os filtros estruturais em memória, garantindo robustez extrema e experiência de usuário ininterrupta.

---

## 4. Auditoria de Gravações e Ciclos de Escrita

Verificamos minuciosamente todos os caminhos de persistência do sistema:
- **Zero loops de escrita**: Não existem loops infinitos ou timers recorrentes sincronizando dados no banco.
- **Gravações baseadas estritamente em ações reais**:
  - `saveInspection`: Chamado apenas quando o usuário preenche e salva o formulário de lançamento ou edição.
  - `deleteInspection`: Acionado apenas via confirmação de exclusão pelo usuário.
  - `saveConfig`: Acionado apenas ao alterar as configurações globais do sistema.
  - `addAuditLog`: Registra uma única linha de log de auditoria no Firestore ao salvar/remover documentos ou logar no sistema.

---

## Conclusão

Com as otimizações implementadas, as leituras em tempo real foram restringidas de uma escala indefinida para um número estritamente fixo e controlado de ouvintes. As consultas volumosas foram substituídas por requisições sob demanda perfeitamente coordenadas. O sistema agora está **completamente pronto, leve e otimizado** para operar perfeitamente no plano gratuito **Firebase Spark**.
