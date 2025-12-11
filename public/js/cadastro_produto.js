document.addEventListener('DOMContentLoaded', () => {
    // Apenas os elementos necessários para o formulário de CRIAÇÃO (POST)
    const produtoForm = document.getElementById('produtoForm');
    const formMessage = document.getElementById('form-message');

    function showMessage(type, message) {
        if (!formMessage) return;
        formMessage.textContent = message;
        formMessage.className = `alert alert-${type}`;
        formMessage.style.display = 'block';
        setTimeout(() => formMessage.style.display = 'none', 5000);
    }

    // Lógica para submissão do formulário (Criação - POST)
    if (produtoForm) {
        produtoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                sku: document.getElementById('sku').value,
                nome: document.getElementById('nome').value,
                estoque_minimo: parseInt(document.getElementById('estoque_minimo').value),
                peso: parseFloat(document.getElementById('peso').value) || null,
                descricao: document.getElementById('descricao').value || null,
                caracteristicas: document.getElementById('caracteristicas').value || null,
            };

            try {
                const response = await fetch('/api/produtos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                // Se houver falha de autenticação (401), o servidor deve retornar JSON, mas o código
                // abaixo garante o redirecionamento.
                if (response.status === 401) {
                    window.location.href = '/views/login.html';
                    return;
                }

                const result = await response.json();

                if (response.ok) {
                    showMessage('success', result.message);
                    produtoForm.reset(); // Limpa o formulário após o cadastro
                    window.scrollTo(0, 0); 
                } else {
                    showMessage('error', result.message || 'Erro ao cadastrar produto.');
                }

            } catch (error) {
                console.error('Erro na requisição POST:', error);
                // Inclui verificação de erro de JSON, caso o servidor retorne HTML de login (erro anterior)
                if (error instanceof SyntaxError) {
                    showMessage('error', 'Erro de comunicação: O servidor não retornou dados válidos. (Sessão expirada?)');
                } else {
                    showMessage('error', 'Erro ao comunicar com o servidor.');
                }
            }
        });
    }
});
// Nota: A função logout() está no script inline do HTML.