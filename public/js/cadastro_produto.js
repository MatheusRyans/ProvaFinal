document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('produtoForm');
    const searchForm = document.getElementById('searchForm');
    const tableBody = document.getElementById('produtosTable').querySelector('tbody');
    const formMessage = document.getElementById('form-message');
    const idProdutoEdit = document.getElementById('id_produto_edit');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // --- FUNÇÕES DE UTILIDADE ---

    function showMessage(type, message) {
        formMessage.textContent = message;
        formMessage.className = `alert alert-${type}`;
        formMessage.style.display = 'block';
        setTimeout(() => formMessage.style.display = 'none', 5000);
    }

    function resetForm() {
        form.reset();
        idProdutoEdit.value = '';
        submitBtn.textContent = 'Cadastrar Produto';
        cancelBtn.style.display = 'none';
    }

    // --- FUNÇÕES DE API ---

    // RF6.1.1 e RF6.1.2: Carregar a lista de produtos
    async function fetchProdutos(searchTerm = '') {
        try {
            const url = searchTerm ? `/api/produtos?termo=${encodeURIComponent(searchTerm)}` : '/api/produtos';
            const response = await fetch(url);

            if (response.status === 401) { // Não autenticado
                window.location.href = '/views/login.html';
                return;
            }

            const produtos = await response.json();
            renderTable(produtos);
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            showMessage('error', 'Erro ao carregar a lista de produtos.');
        }
    }

    // RF6.1.3 e RF6.1.4: Submissão do Formulário (Criação ou Edição)
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const data = {
            sku: document.getElementById('sku').value,
            nome: document.getElementById('nome').value,
            estoque_minimo: parseInt(document.getElementById('estoque_minimo').value),
            peso: parseFloat(document.getElementById('peso').value) || null,
            caracteristicas: document.getElementById('caracteristicas').value
        };
        
        // RF6.1.6: Validação básica Front-end
        if (!data.sku || !data.nome || isNaN(data.estoque_minimo)) {
            showMessage('error', 'Por favor, preencha todos os campos obrigatórios (SKU, Nome, Estoque Mínimo).');
            return;
        }

        const method = idProdutoEdit.value ? 'PUT' : 'POST';
        const url = idProdutoEdit.value ? `/api/produtos/${idProdutoEdit.value}` : '/api/produtos';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage('success', result.message);
                resetForm();
                fetchProdutos(); // Atualiza a lista
            } else {
                showMessage('error', result.message || `Erro ao ${method === 'POST' ? 'cadastrar' : 'atualizar'} produto.`);
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            showMessage('error', 'Erro ao comunicar com o servidor.');
        }
    });

    // --- MANIPULAÇÃO DA TABELA ---

    function renderTable(produtos) {
        tableBody.innerHTML = ''; // Limpa a tabela
        if (produtos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhum produto encontrado.</td></tr>';
            return;
        }

        produtos.forEach(produto => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = produto.id_produto;
            row.insertCell().textContent = produto.sku;
            row.insertCell().textContent = produto.nome;
            row.insertCell().textContent = produto.estoque_minimo;
            
            // Botões de Ações
            const actionsCell = row.insertCell();
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.style.backgroundColor = '#ffc107';
            editBtn.style.color = '#333';
            editBtn.onclick = () => loadProdutoForEdit(produto); // RF6.1.4
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Excluir';
            deleteBtn.style.backgroundColor = '#dc3545';
            deleteBtn.style.marginLeft = '10px';
            deleteBtn.onclick = () => deleteProduto(produto.id_produto, produto.nome); // RF6.1.5

            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        });
    }
    
    // RF6.1.4: Carrega dados para edição
    function loadProdutoForEdit(produto) {
        idProdutoEdit.value = produto.id_produto;
        document.getElementById('sku').value = produto.sku;
        document.getElementById('nome').value = produto.nome;
        document.getElementById('estoque_minimo').value = produto.estoque_minimo;
        document.getElementById('peso').value = produto.peso || '';
        document.getElementById('caracteristicas').value = produto.caracteristicas || '';
        
        submitBtn.textContent = `Salvar Edição (ID: ${produto.id_produto})`;
        cancelBtn.style.display = 'inline-block';
        window.scrollTo(0, 0); // Volta ao topo do formulário
    }

    // RF6.1.5: Excluir Produto
    async function deleteProduto(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir o produto: ${nome}? Esta ação é irreversível e excluirá todo o histórico de movimentação.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (response.ok) {
                showMessage('success', result.message);
                fetchProdutos();
            } else {
                showMessage('error', result.message || 'Erro ao excluir produto.');
            }
        } catch (error) {
            console.error('Erro na exclusão:', error);
            showMessage('error', 'Erro ao comunicar com o servidor para exclusão.');
        }
    }

    // RF6.1.2: Busca
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const searchTerm = document.getElementById('searchTerm').value;
        fetchProdutos(searchTerm);
    });

    cancelBtn.addEventListener('click', resetForm);

    // Carrega a lista inicial (RF6.1.1)
    fetchProdutos();
});