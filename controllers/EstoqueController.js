const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Rota GET: Listar Estoque (RF7.1.1 - Ordenação)
router.get('/', async (req, res) => {
    // RF7.1.1: Listar produtos em ordem alfabética
    const query = `
        SELECT 
            p.id_produto, p.sku, p.nome, p.estoque_minimo, e.saldo_atual
        FROM PRODUTO p
        JOIN ESTOQUE e ON p.id_produto = e.id_produto
        ORDER BY p.nome ASC
    `;

    try {
        const [rows] = await db.execute(query);
        // Implementação do algoritmo de ordenação (ex: Bubble Sort)
        // O MySQL já ordenou com ORDER BY, mas se fosse necessário no Node:
        // const sortedRows = bubbleSort(rows); 
        // return res.json(sortedRows);
        
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar estoque:', error);
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

        // 1. Atualizar o saldo do estoque
        const operacao = tipo_movimentacao === 'Entrada' ? '+' : '-';
        
        await connection.execute(
            `UPDATE ESTOQUE SET saldo_atual = saldo_atual ${operacao} ? WHERE id_produto = ?`,
            [quantidade, id_produto]
        );

        // 2. Inserir na MOVIMENTACAO (Histórico)
        await connection.execute(
            'INSERT INTO MOVIMENTACAO (id_produto, id_usuario, tipo_movimentacao, quantidade, data_hora) VALUES (?, ?, ?, ?, ?)',
            [id_produto, id_usuario, tipo_movimentacao, quantidade, data || new Date()]
        );
        
        // 3. Verificar Estoque Mínimo (RF7.1.4 - Apenas para Saída)
        if (tipo_movimentacao === 'Saída') {
            const [rows] = await connection.execute(
                'SELECT e.saldo_atual, p.estoque_minimo FROM ESTOQUE e JOIN PRODUTO p ON e.id_produto = p.id_produto WHERE e.id_produto = ?',
                [id_produto]
            );
            
            if (rows.length > 0) {
                const { saldo_atual, estoque_minimo } = rows[0];
                if (saldo_atual < estoque_minimo) {
                    alertaEstoqueMinimo = true;
                }
            }
        }

        await connection.commit();
        res.json({ 
            success: true, 
            message: 'Movimentação registrada com sucesso.',
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