const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Connexion PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Création automatique des tables au démarrage
pool.query(`
    CREATE TABLE IF NOT EXISTS locataires (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100),
        prenom VARCHAR(100),
        email VARCHAR(100),
        telephone VARCHAR(50),
        date_naissance DATE
    );

    CREATE TABLE IF NOT EXISTS biens (
        id SERIAL PRIMARY KEY,
        nom_bien VARCHAR(150),
        type VARCHAR(50),
        loyer NUMERIC,
        statut VARCHAR(50) DEFAULT 'Libre'
    );
`).then(() => {
    console.log("Tables 'locataires' et 'biens' vérifiées ou créées avec succès.");
}).catch(err => {
    console.error("Erreur création tables :", err);
});

// --- ROUTES PAGES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});

app.get('/locataires', (req, res) => {
    res.sendFile(path.join(__dirname, 'locataires.html'));
});

app.get('/biens', (req, res) => {
    res.sendFile(path.join(__dirname, 'biens.html'));
});

// --- API : LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) 
            VALUES ($1, $2, $3, $4, $5);
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance]);
        res.redirect('/locataires');
    } catch (err) {
        console.error("Erreur insertion :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.put('/api/locataires/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        const query = `
            UPDATE locataires 
            SET nom = $1, prenom = $2, email = $3, telephone = $4, date_naissance = $5 
            WHERE id = $6;
        `;
        await pool.query(query, [nom, prenom, email, telephone, date_naissance, id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur modification :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.delete('/api/locataires/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM locataires WHERE id = $1;', [id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : BIENS ---
app.get('/api/biens', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM biens ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture biens :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.post('/api/biens', async (req, res) => {
    const { nom_bien, type, loyer, statut } = req.body;
    try {
        const query = `
            INSERT INTO biens (nom_bien, type, loyer, statut) 
            VALUES ($1, $2, $3, $4);
        `;
        await pool.query(query, [nom_bien, type, loyer, statut || 'Libre']);
        res.redirect('/biens');
    } catch (err) {
        console.error("Erreur insertion bien :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.delete('/api/biens/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM biens WHERE id = $1;', [id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression bien :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
