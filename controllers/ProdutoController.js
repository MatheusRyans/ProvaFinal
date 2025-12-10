const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Middleware de Validação (RF6.1.6)
const validateProduto = (req, res, next) => {
    const { sku, nome, estoque_minimo } = req.body;
    if (!sku || !nome || estoque_minimo === undefined || estoque_minimo === null) {
        return res.status(400).json({ message: 'SKU, Nome e Estoque Mínimo são obrigatórios.' });
    }
    if (isNaN(parseInt(estoque_minimo)) || parseInt(estoque_minimo) < 0) {
        return res.status(400).json({ message: 'Estoque Mínimo deve ser um número inteiro positivo.' });
    }
    next();
};

// Rota GET: Listar Produtos (RF6.1.1 e RF6.1.2 - Busca)
router.get('/', async (req, res) => {
    const termo = req.query.termo;
    let query = 'SELECT * FROM PRODUTO';
    const params = [];

    if (termo) {
        // RF6.1.2: Implementa busca por termo no nome ou sku
        query += ' WHERE nome LIKE ? OR sku LIKE ?';
        const searchPattern = `%${termo}%`;
        params.push(searchPattern, searchPattern);
    }

    try {
        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos.' });
    }
});

// Rota POST: Inserir Novo Produto (RF6.1.3)
router.post('/', validateProduto, async (req, res) => {
    const { sku, nome, descricao, peso, caracteristicas, estoque_minimo } = req.body;
    let connection;

    try {
        // Verifica se o SKU já existe (RF6.1.6 - Validação Back-end)
        const [existing] = await db.execute('SELECT sku FROM PRODUTO WHERE sku = ?', [sku]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'SKU já cadastrado.' });
        }


        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Inserir na tabela PRODUTO (agora com saldo_atual = 0 por default)
        const [result] = await connection.execute(
            'INSERT INTO PRODUTO (sku, nome, descricao, peso, caracteristicas, estoque_minimo) VALUES (?, ?, ?, ?, ?, ?)',
            [sku, nome, descricao, peso, caracteristicas, estoque_minimo]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: 'Produto cadastrado com sucesso!', id: result.insertId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao cadastrar produto:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar produto.' });
    } finally {
        if (connection) connection.release();
    }
});

// Rota PUT: Editar Produto (RF6.1.4)
router.put('/:id', validateProduto, async (req, res) => {
    const id = req.params.id;
    const { sku, nome, descricao, peso, caracteristicas, estoque_minimo } = req.body;

    // Tratamento de undefined para null também é recomendado para o PUT, 
    // caso o cliente envie um JSON onde a descrição seja null, mas o corpo não
    // contenha a variável explicitamente (o que tornaria undefined)
    const valoresAtualizados = [
        sku,
        nome,
        descricao === undefined ? null : descricao,
        peso === undefined ? null : peso,
        caracteristicas === undefined ? null : caracteristicas,
        estoque_minimo, // Já validado como obrigatório
        id
    ];

    try {
        // Verifica unicidade do SKU (excluindo o próprio produto)
        const [existing] = await db.execute('SELECT id_produto FROM PRODUTO WHERE sku = ? AND id_produto != ?', [sku, id]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'SKU já cadastrado por outro produto.' });
        }

        const [result] = await db.execute(
            'UPDATE PRODUTO SET sku = ?, nome = ?, descricao = ?, peso = ?, caracteristicas = ?, estoque_minimo = ? WHERE id_produto = ?',
            valoresAtualizados // Usando o array tratado
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        res.json({ success: true, message: 'Produto atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao editar produto:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar produto.' });
    }
});

// Rota DELETE: Excluir Produto (RF6.1.5)
router.delete('/:id', async (req, res) => {
    const id = req.params.id;
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Deletar dependências (MOVIMENTACAO e ESTOQUE) antes de PRODUTO
        await connection.execute('DELETE FROM MOVIMENTACAO WHERE id_produto = ?', [id]);
        await connection.execute('DELETE FROM ESTOQUE WHERE id_produto = ?', [id]);

        const [result] = await connection.execute('DELETE FROM PRODUTO WHERE id_produto = ?', [id]);

        await connection.commit();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }

        res.json({ success: true, message: 'Produto excluído com sucesso.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao excluir produto.' });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;