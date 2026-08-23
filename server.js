const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Fichiers statiques (CSS, JS front, etc.)
app.use(express.static(path.join(__dirname)));

// Connexion PostgreSQL sur Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- ROUTES PAGES HTML ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});

app.get('/locataires', (req, res) => {
    res.sendFile(path.join(__dirname, 'locataires.html'));
});

// --- API : LISTE DES LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture locataires :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : AJOUT D'UN LOCATAIRE ---
app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance]);
        res.redirect('/locataires'); // Redirige vers la liste des locataires après ajout
    } catch (err) {
        console.error("Erreur insertion locataire :", err);
        res.status(500).send("Erreur lors de l'enregistrement.");
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
