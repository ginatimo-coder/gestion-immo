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

// Création automatique de TOUTES les tables au démarrage
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

    CREATE TABLE IF NOT EXISTS baux (
        id SERIAL PRIMARY KEY,
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        date_debut DATE,
        date_fin DATE,
        contrat_url TEXT
    );

    CREATE TABLE IF NOT EXISTS paiements (
        id SERIAL PRIMARY KEY,
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        date_paiement DATE,
        montant NUMERIC,
        statut VARCHAR(50) DEFAULT 'Payé'
    );
`).then(() => {
    console.log("Toutes les tables (locataires, biens, baux, paiements) sont prêtes.");
}).catch(err => {
    console.error("Erreur création tables :", err);
});

// --- ROUTES PAGES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/locataires', (req, res) => res.sendFile(path.join(__dirname, 'locataires.html')));
app.get('/nouveau-locataire', (req, res) => res.sendFile(path.join(__dirname, 'nouveau-locataire.html')));
app.get('/biens', (req, res) => res.sendFile(path.join(__dirname, 'biens.html')));
app.get('/baux', (req, res) => res.sendFile(path.join(__dirname, 'baux.html')));
app.get('/paiements', (req, res) => res.sendFile(path.join(__dirname, 'paiements.html')));

// --- API : LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture locataires :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.post('/api/locataires', async (req, res) => {
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        await pool.query('INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) VALUES ($1, $2, $3, $4, $5)', [nom, prenom, email, telephone, date_naissance]);
        res.redirect('/locataires');
    } catch (err) {
        console.error("Erreur insertion locataire :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.put('/api/locataires/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, email, telephone, date_naissance } = req.body;
    try {
        await pool.query('UPDATE locataires SET nom = $1, prenom = $2, email = $3, telephone = $4, date_naissance = $5 WHERE id = $6', [nom, prenom, email, telephone, date_naissance, id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur modification locataire :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.delete('/api/locataires/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM locataires WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression locataire :", err);
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
        await pool.query('INSERT INTO biens (nom_bien, type, loyer, statut) VALUES ($1, $2, $3, $4)', [nom_bien, type, loyer, statut || 'Libre']);
        res.redirect('/biens');
    } catch (err) {
        console.error("Erreur insertion bien :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.delete('/api/biens/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM biens WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression bien :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : BAUX ---
app.get('/api/baux', async (req, res) => {
    try {
        const query = `
            SELECT baux.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
            FROM baux 
            JOIN locataires ON baux.locataire_id = locataires.id 
            JOIN biens ON baux.bien_id = biens.id 
            ORDER BY baux.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture baux :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.post('/api/baux', async (req, res) => {
    const { locataire_id, bien_id, date_debut, date_fin, contrat_url } = req.body;
    try {
        await pool.query('INSERT INTO baux (locataire_id, bien_id, date_debut, date_fin, contrat_url) VALUES ($1, $2, $3, $4, $5)', [locataire_id, bien_id, date_debut, date_fin || null, contrat_url || null]);
        await pool.query("UPDATE biens SET statut = 'Loué' WHERE id = $1", [bien_id]);
        res.redirect('/baux');
    } catch (err) {
        console.error("Erreur insertion bail :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.delete('/api/baux/:id', async (req, res) => {
    try {
        const bail = await pool.query('SELECT bien_id FROM baux WHERE id = $1', [req.params.id]);
        if (bail.rows.length > 0) {
            await pool.query("UPDATE biens SET statut = 'Libre' WHERE id = $1", [bail.rows[0].bien_id]);
        }
        await pool.query('DELETE FROM baux WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression bail :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// --- API : PAIEMENTS ---
app.get('/api/paiements', async (req, res) => {
    try {
        const query = `
            SELECT paiements.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
            FROM paiements 
            JOIN locataires ON paiements.locataire_id = locataires.id 
            JOIN biens ON paiements.bien_id = biens.id 
            ORDER BY paiements.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur lecture paiements :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.post('/api/paiements', async (req, res) => {
    const { locataire_id, bien_id, date_paiement, montant, statut } = req.body;
    try {
        await pool.query('INSERT INTO paiements (locataire_id, bien_id, date_paiement, montant, statut) VALUES ($1, $2, $3, $4, $5)', [locataire_id, bien_id, date_paiement, montant, statut || 'Payé']);
        res.redirect('/paiements');
    } catch (err) {
        console.error("Erreur insertion paiement :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.put('/api/paiements/:id', async (req, res) => {
    const { montant } = req.body;
    try {
        await pool.query('UPDATE paiements SET montant = $1 WHERE id = $2', [montant, req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur modification paiement :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.delete('/api/paiements/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM paiements WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error("Erreur suppression paiement :", err);
        res.status(500).send("Erreur serveur.");
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
