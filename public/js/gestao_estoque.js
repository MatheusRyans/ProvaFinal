document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('estoqueTable').querySelector('tbody');
    const modal = document.getElementById('movimentacaoModal');
    const form = document.getElementById('movimentacaoForm');
    const globalAlert = document.getElementById('global-alert');
    const movMessage = document.getElementById('mov-message');
    const feedbackMessage = document.getElementById('feedback-message'); 
    const lowStockList = document.getElementById('low-stock-list'); 
    const cancelModalBtn = document.getElementById('cancelModalBtn'); // Botão Cancelar do Modal
    
    // Configura a data atual como padrão no campo de data e hora do modal
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('data').value = now.toISOString().slice(0, 16);


    // --- FUNÇÕES DE UTILIDADE ---

    function showMovMessage(type, message) {
        // Exibe mensagem dentro do Modal de Movimentação
        movMessage.textContent = message;
        movMessage.className = `alert alert-${type}`;
        movMessage.style.display = 'block';
        setTimeout(() => movMessage.style.display = 'none', 5000);
    }
    
    function showFeedbackMessage(type, message) {
        // Exibe mensagem de feedback na tela principal (substitui alert() nativo)
        feedbackMessage.textContent = message;
        feedbackMessage.className = `alert alert-${type}`;
        feedbackMessage.style.display = 'block';
        setTimeout(() => feedbackMessage.style.display = 'none', 5000);
    }

    window.closeModal = function() { // Função global para o botão Cancelar
        modal.close(); // Fecha o dialog nativo
        form.reset();
        
        // Recarrega a data atual ao fechar
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('data').value = now.toISOString().slice(0, 16);
    }

    // Listener para o botão Cancelar do Modal
    cancelModalBtn.addEventListener('click', closeModal);
    
    // --- FUNÇÕES DE API ---

    // RF7.1.1: Carregar a lista de estoque (saldo vem direto da tabela PRODUTO)
    async function fetchEstoque() {
        try {
            const response = await fetch('/api/estoque');

            if (response.status === 401) { 
                window.location.href = '/views/login.html';
                return;
            }

            const estoque = await response.json();
            renderTable(estoque);
        } catch (error) {
            console.error('Erro ao buscar estoque:', error);
        }
    }

    // RF7.1.2/RF7.1.4: Submissão da Movimentação e Verificação do Estoque Mínimo
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id_produto = document.getElementById('movimentacaoIdProduto').value;
        const tipo_movimentacao = document.getElementById('tipo_movimentacao').value;
        const quantidade = parseInt(document.getElementById('quantidade').value);
        const data = document.getElementById('data').value;

        if (!id_produto || !tipo_movimentacao || quantidade <= 0 || !data) {
            showMovMessage('error', 'Preencha todos os campos corretamente.');
            return;
        }

        try {
            const response = await fetch('/api/estoque/movimentar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_produto, tipo_movimentacao, quantidade, data })
            });

            const result = await response.json();

            if (response.ok) {
                closeModal();
                fetchEstoque(); // Atualiza a lista após a movimentação
                
                let successMessage = result.message;
                
                // RF7.1.4: Alerta de Estoque Mínimo - Usa notificação HTML
                if (result.alerta_estoque_minimo) {
                    successMessage += `\n🚨 NOTIFICAÇÃO: O produto agora está ABAIXO do estoque mínimo.`;
                }
                
                showFeedbackMessage('success', successMessage);

            } else {
                showMovMessage('error', result.message || 'Erro ao registrar movimentação.');
            }

        } catch (error) {
            console.error('Erro na requisição de movimentação:', error);
            showMovMessage('error', 'Erro ao comunicar com o servidor.');
        }
    });

    // --- MANIPULAÇÃO DA TABELA E ALERTA GLOBAL ---

    function renderTable(estoque) {
        tableBody.innerHTML = '';
        let lowStockCount = 0;
        const lowStockNames = [];

        estoque.forEach(item => {
            const isLowStock = item.saldo_atual < item.estoque_minimo;
            if (isLowStock) {
                lowStockCount++;
                lowStockNames.push(item.nome); // Coleta nomes para o alerta global
            }
            
            const row = tableBody.insertRow();
            row.style.backgroundColor = isLowStock ? '#f8d7da' : ''; // Linha destacada para baixo estoque
            
            row.insertCell().textContent = item.id_produto;
            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = item.sku;
            row.insertCell().textContent = item.estoque_minimo;
            row.insertCell().textContent = item.saldo_atual;
            
            // Status do Estoque
            const statusCell = row.insertCell();
            statusCell.textContent = isLowStock ? 'ABAIXO DO MÍNIMO' : 'OK';
            statusCell.style.color = isLowStock ? '#dc3545' : '#28a745';

            // Botão de Ação (RF7.1.2)
            const actionsCell = row.insertCell();
            const moveBtn = document.createElement('button');
            moveBtn.textContent = 'Movimentar';
            moveBtn.style.backgroundColor = '#007bff';
            moveBtn.onclick = () => openModal(item.id_produto, item.nome);
            actionsCell.appendChild(moveBtn);
        });

        // Atualiza e exibe/oculta o alerta global no topo (RF7.1.4)
        if (lowStockCount > 0) {
            // Exibe os nomes dos produtos em alerta
            lowStockList.textContent = lowStockNames.join(', ');
            globalAlert.style.display = 'block';
        } else {
            lowStockList.textContent = '';
            globalAlert.style.display = 'none';
        }
    }

    // RF7.1.2: Abre o modal para iniciar a movimentação
    function openModal(id, nome) {
        document.getElementById('movimentacaoIdProduto').value = id;
        document.getElementById('movimentacaoProdutoNome').textContent = nome;
        modal.showModal(); // Usa o método nativo do dialog para mostrar como modal
    }
    
    // Inicialização: Carrega o estoque
    fetchEstoque();
});