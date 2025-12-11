document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DE PRODUTOS (CRUD - Edição/Exclusão) ---
    const produtoFormEdit = document.getElementById('produtoFormEdit');
    
    // CORREÇÃO DE ROBUSTEZ: Verifica se 'produtosTable' existe antes de buscar o 'tbody'.
    const produtosTable = document.getElementById('produtosTable');
    const produtosTableBody = produtosTable ? produtosTable.querySelector('tbody') : null;
    
    const formMessage = document.getElementById('form-message'); // Mensagem perto do formulário de Edição
    const idProdutoEdit = document.getElementById('id_produto_edit');
    const editProdutoIdDisplay = document.getElementById('editProdutoIdDisplay');
    const cancelBtnEdit = document.getElementById('cancelBtnEdit');
    const searchForm = document.getElementById('searchForm');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    
    // --- ELEMENTOS DE ESTOQUE (MOVIMENTAÇÃO) ---
    const estoqueTable = document.getElementById('estoqueTable'); // Adicionado para segurança
    const estoqueTableBody = estoqueTable ? estoqueTable.querySelector('tbody') : null; // Aplicado a mesma segurança
    const modal = document.getElementById('movimentacaoModal');
    const movimentacaoForm = document.getElementById('movimentacaoForm');
    const globalAlert = document.getElementById('global-alert');
    const feedbackMessage = document.getElementById('feedback-message'); // Mensagem global no topo
    const lowStockList = document.getElementById('low-stock-list'); 
    const cancelModalBtn = document.getElementById('cancelModalBtn'); 
    
    // Configuração inicial de data no modal
    const dataInput = document.getElementById('data');
    if (dataInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dataInput.value = now.toISOString().slice(0, 16);
    }

    // --- FUNÇÕES DE UTILIDADE ---

    function showFormMessage(type, message) { 
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.className = `alert alert-${type}`;
        formMessage.style.display = 'block';
        setTimeout(() => formMessage.style.display = 'none', 5000);
    }

    function showFeedbackMessage(type, message) { 
        if (feedbackMessage) {
            feedbackMessage.textContent = message;
            feedbackMessage.className = `alert alert-${type}`;
            feedbackMessage.style.display = 'block';
            setTimeout(() => feedbackMessage.style.display = 'none', 5000);
        }
    }
    
    function resetProdutoFormEdit() {
        if (produtoFormEdit) produtoFormEdit.reset();
        if (idProdutoEdit) idProdutoEdit.value = '';
        if (editProdutoIdDisplay) editProdutoIdDisplay.textContent = '';
        if (produtoFormEdit) produtoFormEdit.style.display = 'none'; // Esconde o formulário de edição
        window.scrollTo(0, 0); 
    }

    window.closeModal = function() {
        if (modal && modal.close) { 
            modal.close();
        }
        if (movimentacaoForm) {
            movimentacaoForm.reset();
        }
        
        // Recarrega a data atual ao fechar
        if (dataInput) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dataInput.value = now.toISOString().slice(0, 16);
        }
    }

    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', closeModal);
    }
    if (cancelBtnEdit) {
        cancelBtnEdit.addEventListener('click', resetProdutoFormEdit);
    }


    // --- LÓGICA DE PRODUTOS (EDIÇÃO/EXCLUSÃO - RF6) ---

    // RF6.1.1, RF6.1.2: Carregar a lista de produtos (para gestão e edição)

// RF6.1.1, RF6.1.2: Carregar a lista de produtos (para gestão e edição)
async function fetchProdutos(searchTerm = '') {
    try {
        const url = searchTerm ? `/api/produtos?termo=${encodeURIComponent(searchTerm)}` : '/api/produtos';
        const response = await fetch(url);

        // 1. CHECAGEM DE AUTENTICAÇÃO
        if (response.status === 401) { 
            // Se o servidor retornar 401 explicitamente, redireciona o usuário.
            window.location.href = '/views/login.html';
            return;
        }

        // 2. CHECAGEM DE SUCESSO (Status 200-299)
        if (!response.ok) {
            // Lida com outros erros da API (como 404, 500) antes de tentar ler JSON.
            const errorText = await response.text();
            console.error(`Erro na resposta da API (${response.status}): ${errorText.substring(0, 100)}...`);
            showFeedbackMessage('error', `Erro ao buscar produtos: ${response.status} ${response.statusText}`);
            return;
        }

        // 3. TENTA LER O JSON (Isto só será tentado se o status for OK)
        const produtos = await response.json();
        

        renderProdutosTable(produtos);
        fetchEstoque(); 
    } catch (error) {
        // Este catch pega o SyntaxError: Unexpected token '<'
        console.error('Erro ao buscar produtos:', error);
        
        // Mensagem mais informativa sobre a falha de JSON.
        if (error instanceof SyntaxError) {
             showFeedbackMessage('error', 'Erro de comunicação: O servidor não retornou dados válidos. (Sessão expirada?)');
        } else {
             showFeedbackMessage('error', 'Erro ao carregar a lista de produtos para gestão.');
        }
    }
}

    // RF6.1.4: Submissão do Formulário de Edição
    if (produtoFormEdit) {
        produtoFormEdit.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = idProdutoEdit.value;

            const data = {
                sku: document.getElementById('sku_edit').value,
                nome: document.getElementById('nome_edit').value,
                estoque_minimo: parseInt(document.getElementById('estoque_minimo_edit').value),
                peso: parseFloat(document.getElementById('peso_edit').value) || null,
                descricao: document.getElementById('descricao_edit').value || null,
                caracteristicas: document.getElementById('caracteristicas_edit').value || null,
            };

            try {
                const response = await fetch(`/api/produtos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    showFormMessage('success', result.message);
                    resetProdutoFormEdit();
                    fetchProdutos(); // Atualiza a lista de produtos E o estoque
                } else {
                    showFormMessage('error', result.message || 'Erro ao editar produto.');
                }

            } catch (error) {
                console.error('Erro na requisição PUT:', error);
                showFormMessage('error', 'Erro ao comunicar com o servidor.');
            }
        });
    }

    // RF6.1.4: Carregar produto para edição
    function loadProdutoForEdit(produto) {
        if (!idProdutoEdit || !editProdutoIdDisplay || !produtoFormEdit) return;
        
        idProdutoEdit.value = produto.id_produto;
        editProdutoIdDisplay.textContent = produto.id_produto;
        
        document.getElementById('sku_edit').value = produto.sku;
        document.getElementById('nome_edit').value = produto.nome;
        document.getElementById('estoque_minimo_edit').value = produto.estoque_minimo;
        document.getElementById('peso_edit').value = produto.peso || '';
        document.getElementById('descricao_edit').value = produto.descricao || '';
        document.getElementById('caracteristicas_edit').value = produto.caracteristicas || '';
        
        produtoFormEdit.style.display = 'block'; // Mostra o formulário de edição
        window.scrollTo(0, 0); // Volta ao topo do formulário
    }

    // RF6.1.5: Excluir Produto
    window.deleteProduto = async function(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir o produto: ${nome}? Esta ação é irreversível e excluirá todo o histórico de movimentação.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (response.ok) {
                showFeedbackMessage('success', result.message);
                resetProdutoFormEdit(); // Caso estivesse editando o produto
                fetchProdutos(); // Atualiza as duas tabelas
            } else {
                showFeedbackMessage('error', result.message || 'Erro ao excluir produto.');
            }
        } catch (error) {
            console.error('Erro na exclusão:', error);
            showFeedbackMessage('error', 'Erro ao comunicar com o servidor para exclusão.');
        }
    }

    // Renderiza a Tabela de Gestão de Produtos (Edição/Excluir)
    function renderProdutosTable(produtos) {
        if (!produtosTableBody) return;
        produtosTableBody.innerHTML = '';

        produtos.forEach(produto => {
            const row = produtosTableBody.insertRow();
            
            row.insertCell().textContent = produto.id_produto;
            row.insertCell().textContent = produto.nome;
            row.insertCell().textContent = produto.sku;
            row.insertCell().textContent = produto.estoque_minimo;
            row.insertCell().textContent = produto.saldo_atual;

            // Célula de Ações (Editar e Excluir)
            const actionsCell = row.insertCell();

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.style.backgroundColor = '#ffc107';
            editBtn.style.color = '#333';
            editBtn.onclick = () => loadProdutoForEdit(produto);
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Excluir';
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.style.marginLeft = '10px';
            deleteBtn.onclick = () => deleteProduto(produto.id_produto, produto.nome);
            actionsCell.appendChild(deleteBtn);
        });
    }

    // Listeners da Busca e Reset para a tabela de Produtos
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const searchTerm = document.getElementById('searchTerm').value;
            fetchProdutos(searchTerm);
        });
    }

    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', function() {
            document.getElementById('searchTerm').value = '';
            fetchProdutos('');
        });
    }


    // --- LÓGICA DE ESTOQUE (MOVIMENTAÇÃO - RF7) ---

    // RF7.1.1: Carregar a lista de estoque 
    async function fetchEstoque() {
        try {
            const response = await fetch('/api/estoque');
            const estoque = await response.json();
            renderEstoqueTable(estoque);
        } catch (error) {
            console.error('Erro ao buscar status do estoque:', error);
        }
    }

    // RF7.1.2/RF7.1.4: Submissão da Movimentação
    if (movimentacaoForm) {
        movimentacaoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id_produto = document.getElementById('movimentacaoIdProduto').value;
            const tipo_movimentacao = document.getElementById('tipo_movimentacao').value;
            const quantidade = parseInt(document.getElementById('quantidade').value);
            const data = document.getElementById('data').value;

            if (!id_produto || !tipo_movimentacao || quantidade <= 0 || !data) {
                showFeedbackMessage('error', 'Preencha todos os campos do modal corretamente.');
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
                    // Chama fetchProdutos, que por sua vez chama fetchEstoque, garantindo a atualização das duas tabelas
                    fetchProdutos(); 
                    
                    let successMessage = result.message;
                    
                    if (result.alerta_estoque_minimo) {
                        successMessage += `\n🚨 NOTIFICAÇÃO: O produto agora está ABAIXO do estoque mínimo.`;
                    }
                    
                    showFeedbackMessage('success', successMessage);

                } else {
                    showFeedbackMessage('error', result.message || 'Erro ao registrar movimentação.');
                }

            } catch (error) {
                console.error('Erro na requisição de movimentação:', error);
                showFeedbackMessage('error', 'Erro ao comunicar com o servidor para movimentação.');
            }
        });
    }

    // Renderiza a Tabela de Status de Estoque
    function renderEstoqueTable(estoque) {
        if (!estoqueTableBody) return;
        
        estoqueTableBody.innerHTML = '';
        let lowStockCount = 0;
        const lowStockNames = [];

        estoque.forEach(item => {
            const isLowStock = item.saldo_atual < item.estoque_minimo;
            if (isLowStock) {
                lowStockCount++;
                lowStockNames.push(item.nome);
            }
            
            const row = estoqueTableBody.insertRow();
            // Destaca a linha se o estoque estiver baixo
            row.style.backgroundColor = isLowStock ? '#f8d7da' : '';
            
            row.insertCell().textContent = item.id_produto;
            row.insertCell().textContent = item.nome;
            row.insertCell().textContent = item.sku;
            row.insertCell().textContent = item.estoque_minimo;
            row.insertCell().textContent = item.saldo_atual;
            
            const statusCell = row.insertCell();
            statusCell.textContent = isLowStock ? 'ABAIXO DO MÍNIMO' : 'OK';
            statusCell.style.color = isLowStock ? '#dc3545' : '#28a745';

            const actionsCell = row.insertCell();
            const moveBtn = document.createElement('button');
            moveBtn.textContent = 'Movimentar';
            moveBtn.style.backgroundColor = '#007bff';
            // Chama a função openModal para abrir o modal de movimentação
            moveBtn.onclick = () => openModal(item.id_produto, item.nome);
            actionsCell.appendChild(moveBtn);
        });

        // Atualiza e exibe/oculta o alerta global no topo (RF7.1.4)
        if (lowStockList && globalAlert) { 
            if (lowStockCount > 0) {
                lowStockList.textContent = lowStockNames.join(', ');
                globalAlert.style.display = 'block';
            } else {
                lowStockList.textContent = '';
                globalAlert.style.display = 'none';
            }
        }
    }

    // RF7.1.2: Abre o modal para iniciar a movimentação
    function openModal(id, nome) {
        document.getElementById('movimentacaoIdProduto').value = id;
        document.getElementById('movimentacaoProdutoNome').textContent = nome;
        
        if (modal && modal.showModal) {
            modal.showModal(); 
        }
    }
    
    // Inicialização: Carrega os produtos (que por sua vez carrega o estoque)
    fetchProdutos();
});