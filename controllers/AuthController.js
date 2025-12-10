const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Rota POST para autenticação (Login)
router.post('/login', async (req, res) => {
    const { login, senha } = req.body;

    if (!login || !senha) {
        return res.status(400).json({ message: 'Login e senha são obrigatórios.' });
    }

    try {
        const [rows] = await db.execute('SELECT id_usuario, nome, senha FROM USUARIO WHERE login = ?', [login]);

        if (rows.length === 0) {
            // RF4.1: Falha de autenticação (usuário não encontrado)
            return res.status(401).json({ message: 'Usuário não encontrado.' });
        }

        const user = rows[0];

        // --- SIMULAÇÃO DE VERIFICAÇÃO DE SENHA ---
        // Em um sistema real, você usaria bcrypt para comparar o hash:
        // const match = await bcrypt.compare(senha, user.senha);
        
        // Neste exemplo, faremos uma comparação simples, já que inserimos senhas claras no script SQL
        const match = (senha === user.senha); 
        
        if (match) {
            // Sucesso na autenticação
            req.session.userId = user.id_usuario;
            req.session.userName = user.nome; // RF5.1.1
            return res.json({ success: true, message: 'Autenticação bem-sucedida.' });
        } else {
            // RF4.1: Falha de autenticação (senha inválida)
            return res.status(401).json({ message: 'Senha inválida.' });
        }

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota GET para obter dados do usuário logado (RF5.1.1)
router.get('/user', (req, res) => {
    if (req.session.userName) {
        res.json({ name: req.session.userName });
    } else {
        res.status(401).json({ message: 'Usuário não logado.' });
    }
});


// Rota POST para Logout (RF5.1.2)
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Não foi possível fazer logout.' });
        }
        res.json({ success: true, message: 'Logout realizado.' });
    });
});

module.exports = router;