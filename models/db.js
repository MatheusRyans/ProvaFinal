const mysql = require('mysql2/promise');

// Configurações da Conexão
const db = mysql.createPool({
    host: 'localhost',     
    user: 'root',           
    password: 'cimatec',  
    database: 'saep_db',    
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection()
  .then(() => {
    console.log('✅ Conectado ao banco de dados saep_db com sucesso!');
  })
  .catch(err => {
    console.error('❌ Erro na conexão com o banco de dados:', err);
  });

module.exports = db;