const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// Rota GET: Listar Estoque (RF7.1.1 - Ordenação)
router.get('/', async (req, res) => {
    // A consulta agora pega o saldo diretamente da tabela PRODUTO
    const query = `
        SELECT 
            * 
        FROM PRODUTO
        ORDER BY nome ASC
    `;

    try {
        const [rows] = await db.execute(query);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar estoque (simplificado):', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar estoque.' });
    }
});


// Rota POST: Registrar Movimentação (RF7.1.2, RF7.1.4)
router.post('/movimentar', async (req, res) => {
    const { id_produto, tipo_movimentacao, quantidade, data } = req.body;
    const id_usuario = req.session.userId; // Responsável (RF07.2)

    if (!id_produto || !tipo_movimentacao || !quantidade || !id_usuario) {
        return res.status(400).json({ message: 'Dados incompletos para movimentação.' });
    }

    if (quantidade <= 0) {
        return res.status(400).json({ message: 'Quantidade deve ser maior que zero.' });
    }


    let connection;
    let alertaEstoqueMinimo = false;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Obter Saldo Atual e Estoque Mínimo ANTES da atualização
        const [produtoInfo] = await connection.execute(
            'SELECT saldo_atual, estoque_minimo FROM PRODUTO WHERE id_produto = ? FOR UPDATE', // FOR UPDATE bloqueia a linha
            [id_produto]
        );

        if (produtoInfo.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        const { saldo_atual, estoque_minimo } = produtoInfo[0];
        let novo_saldo;

        // 2. Calcular e Validar o Novo Saldo
        if (tipo_movimentacao === 'Entrada') {
            novo_saldo = saldo_atual + quantidade;
        } else {
            novo_saldo = saldo_atual - quantidade;
            if (novo_saldo < 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Não há estoque suficiente para esta saída. Saldo atual: ' + saldo_atual });
            }
        }

        // 3. Atualizar o saldo na tabela PRODUTO
        await connection.execute(
            'UPDATE PRODUTO SET saldo_atual = ? WHERE id_produto = ?',
            [novo_saldo, id_produto]
        );

        // 4. Inserir na MOVIMENTACAO (Histórico)
        await connection.execute(
            'INSERT INTO MOVIMENTACAO (id_produto, id_usuario, tipo_movimentacao, quantidade, data_hora) VALUES (?, ?, ?, ?, ?)',
            [id_produto, id_usuario, tipo_movimentacao, quantidade, data || new Date()]
        );

        // 5. Verificar Estoque Mínimo (RF7.1.4 - Apenas para Saída)
        if (tipo_movimentacao === 'Saída' && novo_saldo < estoque_minimo) {
            alertaEstoqueMinimo = true;
        }

        await connection.commit();
        res.json({
            success: true,
            message: 'Movimentação registrada com sucesso. Novo saldo: ' + novo_saldo,
            alerta_estoque_minimo: alertaEstoqueMinimo
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao registrar movimentação:', error);
        // Pode ocorrer erro de saldo negativo se não houver validação no front ou cláusula no DB
        if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
            return res.status(400).json({ message: 'Não há estoque suficiente para esta saída.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor ao registrar movimentação.' });

    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;