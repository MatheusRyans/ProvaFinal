document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('estoqueTable').querySelector('tbody');
    const modal = document.getElementById('movimentacaoModal');
    const form = document.getElementById('movimentacaoForm');
    const globalAlert = document.getElementById('global-alert');
    const movMessage = document.getElementById('mov-message');
    
    // Configura a data atual como padrão no campo de data e hora
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('data').value = now.toISOString().slice(0, 16);


    // --- FUNÇÕES DE UTILIDADE ---

    function showMovMessage(type, message) {
        movMessage.textContent = message;
        movMessage.className = `alert alert-${type}`;
        movMessage.style.display = 'block';
        setTimeout(() => movMessage.style.display = 'none', 5000);
    }
    
    function closeModal() {
        modal.style.display = 'none';
        form.reset();
        // Recarrega a data atual ao fechar
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('data').value = now.toISOString().slice(0, 16);
    }
    
    // --- FUNÇÕES DE API ---

    // RF7.1.1: Carregar a lista de estoque (ordenada por nome no back-end)
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

    // RF7.1.4: Submissão da Movimentação e Verificação do Estoque Mínimo
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
                
                // RF7.1.4: Alerta de Estoque Mínimo
                if (result.alerta_estoque_minimo) {
                    alert(`⚠️ Alerta: O estoque do produto foi atualizado, mas está AGORA abaixo do nível mínimo configurado.`);
                }
                alert(result.message);

            } else {
                showMovMessage('error', result.message || 'Erro ao registrar movimentação.');
            }

        } catch (error) {
            console.error('Erro na requisição de movimentação:', error);
            showMovMessage('error', 'Erro ao comunicar com o servidor.');
        }
    });

    // --- MANIPULAÇÃO DA TABELA E MODAL ---

    function renderTable(estoque) {
        tableBody.innerHTML = '';
        let hasLowStock = false;

        estoque.forEach(item => {
            const isLowStock = item.saldo_atual < item.estoque_minimo;
            if (isLowStock) hasLowStock = true;
            
            const row = tableBody.insertRow();
            row.style.backgroundColor = isLowStock ? '#f8d7da' : ''; // Linha vermelha para baixo estoque
            
            row.insertCell().textContent = item.id_produto;
            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = item.sku;
            row.insertCell().textContent = item.estoque_minimo;
            row.insertCell().textContent = item.saldo_atual;
            
            // Status do Estoque
            const statusCell = row.insertCell();
            statusCell.textContent = isLowStock ? 'ABAIXO DO MÍNIMO' : 'OK';
            statusCell.style.color = isLowStock ? '#dc3545' : '#28a745';

            // Botão de Ação
            const actionsCell = row.insertCell();
            const moveBtn = document.createElement('button');
            moveBtn.textContent = 'Movimentar';
            moveBtn.style.backgroundColor = '#007bff';
            moveBtn.onclick = () => openModal(item.id_produto, item.nome); // RF7.1.2
            actionsCell.appendChild(moveBtn);
        });

        // Exibe/Oculta o alerta global no topo (RF7.1.4)
        globalAlert.style.display = hasLowStock ? 'block' : 'none';
    }

    // RF7.1.2: Abre o modal para iniciar a movimentação
    function openModal(id, nome) {
        document.getElementById('movimentacaoIdProduto').value = id;
        document.getElementById('movimentacaoProdutoNome').textContent = nome;
        modal.style.display = 'block';
    }
    
    // Inicialização: Carrega o estoque
    fetchEstoque();
});