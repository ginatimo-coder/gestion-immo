const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route principale : pointe vers index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});

app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance]);
        res.redirect('/');
    } catch (err) {
        console.error("Erreur :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.listen(port, () => {
    console.log(`Serveur sur le port ${port}`);
});