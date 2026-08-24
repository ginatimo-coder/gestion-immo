const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Création automatique des tables et mise à jour des colonnes si nécessaire
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

    ALTER TABLE baux ADD COLUMN IF NOT EXISTS contrat_url TEXT;

    CREATE TABLE IF NOT EXISTS paiements (
        id SERIAL PRIMARY KEY,
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        date_paiement DATE,
        montant NUMERIC,
        statut VARCHAR(50) DEFAULT 'Payé'
    );

    CREATE TABLE IF NOT EXISTS factures (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20),
        locataire_id INT REFERENCES locataires(id) ON DELETE CASCADE,
        bien_id INT REFERENCES biens(id) ON DELETE CASCADE,
        montant NUMERIC,
        date_emission DATE,
        statut VARCHAR(30) DEFAULT 'Impayée'
    );

    CREATE TABLE IF NOT EXISTS journal_comptable (
        id SERIAL PRIMARY KEY,
        date_operation DATE,
        libelle TEXT,
        compte_debit VARCHAR(50),
        compte_credit VARCHAR(50),
        montant NUMERIC,
        type_flux VARCHAR(50)
    );
`).catch(err => console.error("Erreur tables:", err));

// --- ROUTES D'AUTHENTIFICATION ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie('auth', 'true', { maxAge: 86400000, httpOnly: false });
        res.redirect('/');
    } else {
        res.redirect('/login?erreur=1');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('auth');
    res.redirect('/login');
});

// --- ROUTES PAGES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/locataires', (req, res) => res.sendFile(path.join(__dirname, 'locataires.html')));
app.get('/biens', (req, res) => res.sendFile(path.join(__dirname, 'biens.html')));
app.get('/baux', (req, res) => res.sendFile(path.join(__dirname, 'baux.html')));
app.get('/paiements', (req, res) => res.sendFile(path.join(__dirname, 'paiements.html')));
app.get('/factures', (req, res) => res.sendFile(path.join(__dirname, 'factures.html')));
app.get('/comptabilite', (req, res) => res.sendFile(path.join(__dirname, 'comptabilite.html')));

// --- API LOCATAIRES ---
app.get('/api/locataires', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locataires ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/locataires', async (req, res) => {
    try {
        const { nom, prenom, email, telephone, date_naissance } = req.body;
        await pool.query(
            'INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) VALUES ($1, $2, $3, $4, $5)',
            [nom, prenom, email, telephone, date_naissance || null]
        );
        res.redirect('/locataires');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/locataires/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM locataires WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API BIENS ---
app.get('/api/biens', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM biens ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/biens', async (req, res) => {
    try {
        const { nom_bien, type, loyer, statut } = req.body;
        await pool.query(
            'INSERT INTO biens (nom_bien, type, loyer, statut) VALUES ($1, $2, $3, $4)',
            [nom_bien, type, loyer, statut || 'Libre']
        );
        res.redirect('/biens');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/biens/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM biens WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API BAUX ---
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
        res.status(500).send(err.message);
    }
});

app.post('/api/baux', async (req, res) => {
    try {
        let { locataire_id, bien_id, date_debut, date_fin, contrat_url } = req.body;
        if (!date_debut || date_debut.trim() === '') date_debut = null;
        if (!date_fin || date_fin.trim() === '') date_fin = null;

        await pool.query(
            'INSERT INTO baux (locataire_id, bien_id, date_debut, date_fin, contrat_url) VALUES ($1, $2, $3, $4, $5)',
            [locataire_id, bien_id, date_debut, date_fin, contrat_url || null]
        );
        
        await pool.query("UPDATE biens SET statut = 'Loué' WHERE id = $1", [bien_id]);
        
        res.redirect('/baux');
    } catch (err) {
        console.error("ERREUR SQL (Baux):", err.message);
        res.status(500).send(`<h2 style="color:red;">Erreur Interne du Serveur :</h2><pre>${err.message}</pre>`);
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
        res.status(500).send(err.message);
    }
});

// --- API PAIEMENTS ---
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
        res.status(500).send(err.message);
    }
});

app.post('/api/paiements', async (req, res) => {
    try {
        let { locataire_id, bien_id, date_paiement, montant, statut } = req.body;
        if (!date_paiement || date_paiement.trim() === '') date_paiement = null;

        await pool.query(
            'INSERT INTO paiements (locataire_id, bien_id, date_paiement, montant, statut) VALUES ($1, $2, $3, $4, $5)',
            [locataire_id, bien_id, date_paiement, montant, statut || 'Payé']
        );
        if ((statut || 'Payé') === 'Payé') {
            await pool.query(
                `INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) 
                 VALUES ($1, $2, '531 - Caisse', '706 - Location de biens', $3, 'Encaissement')`,
                [date_paiement, `Encaissement loyer - Locataire ID ${locataire_id}`, montant]
            );
        }
        res.redirect('/paiements');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put('/api/paiements/:id', async (req, res) => {
    try {
        await pool.query('UPDATE paiements SET montant = $1 WHERE id = $2', [req.body.montant, req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/paiements/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM paiements WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API FACTURES & PROFORMAS ---
app.get('/api/factures', async (req, res) => {
    try {
        const query = `
            SELECT factures.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien 
            FROM factures 
            JOIN locataires ON factures.locataire_id = locataires.id 
            JOIN biens ON factures.bien_id = biens.id 
            ORDER BY factures.id DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/factures', async (req, res) => {
    try {
        let { type, locataire_id, bien_id, montant, date_emission, statut } = req.body;
        if (!date_emission || date_emission.trim() === '') date_emission = null;

        await pool.query(
            'INSERT INTO factures (type, locataire_id, bien_id, montant, date_emission, statut) VALUES ($1, $2, $3, $4, $5, $6)',
            [type, locataire_id, bien_id, montant, date_emission, statut || 'Impayée']
        );
        res.redirect('/factures');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete('/api/factures/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM factures WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API COMPTABILITÉ ---
app.get('/api/comptabilite/journal', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM journal_comptable ORDER BY date_operation DESC, id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/comptabilite/ecriture', async (req, res) => {
    try {
        let { date_operation, libelle, compte_debit, compte_credit, montant, type_flux } = req.body;
        if (!date_operation || date_operation.trim() === '') date_operation = null;

        await pool.query(
            `INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [date_operation, libelle, compte_debit, compte_credit, montant, type_flux]
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/comptabilite/synthese', async (req, res) => {
    try {
        const ecritures = await pool.query('SELECT * FROM journal_comptable');
        let totalProduits = 0;
        let totalCharges = 0;
        let comptesMap = {};

        ecritures.rows.forEach(e => {
            const m = parseFloat(e.montant);
            if(!comptesMap[e.compte_debit]) comptesMap[e.compte_debit] = { debit: 0, credit: 0 };
            comptesMap[e.compte_debit].debit += m;
            if(!comptesMap[e.compte_credit]) comptesMap[e.compte_credit] = { debit: 0, credit: 0 };
            comptesMap[e.compte_credit].credit += m;
            if(e.compte_credit.startsWith('7')) totalProduits += m;
            if(e.compte_debit.startsWith('6')) totalCharges += m;
        });

        res.json({
            comptes: comptesMap,
            totalProduits,
            totalCharges,
            resultatNet: totalProduits - totalCharges
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
});
