const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3030;

// Importa os controladores (rotas)
const authRoutes = require('./controllers/AuthController');
const produtoRoutes = require('./controllers/ProdutoController');
const estoqueRoutes = require('./controllers/EstoqueController');

// --- Middleware ---

// Configuração para processar requisições JSON e URL-encoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração de Sessão (necessário para autenticação/login)
app.use(session({
    secret: 'SAEP_Secret_Key_12345', // Chave secreta para assinar o cookie
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // 1 hora de validade
}));

// Servir arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticação simples (protege rotas da API)
const authenticate = (req, res, next) => {
    if (req.session.userId || req.path === '/api/auth/login') {
        next(); // Permite se estiver logado ou se for a rota de login
    } else {
        // Para requisições da API, retorna erro 401
        if (req.xhr || req.headers.accept.includes('json')) {
            res.status(401).json({ message: 'Não autenticado.' });
        } else {
            // Para acesso direto, redireciona para login
            res.redirect('/views/login.html');
        }
    }
};

// --- Rotas ---

// Rota de autenticação não precisa de autenticação prévia
app.use('/api/auth', authRoutes);

// Protege as rotas da API que requerem login
app.use('/api/produtos', authenticate, produtoRoutes);
app.use('/api/estoque', authenticate, estoqueRoutes);

// Rota principal (redirecionamento após login)
app.get('/principal', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/views/index.html'));
});

// Redireciona a raiz para a tela de login
app.get('/', (req, res) => {
    res.redirect('/views/login.html');
});


// --- Inicialização do Servidor ---
app.listen(port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});