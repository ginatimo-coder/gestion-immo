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

// Création automatique des tables et mise à jour
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

    CREATE TABLE IF NOT EXISTS caisse (
        id SERIAL PRIMARY KEY,
        date_operation DATE,
        libelle TEXT,
        type_mouvement VARCHAR(20), -- 'Entree' ou 'Sortie'
        montant NUMERIC
    );

    CREATE TABLE IF NOT EXISTS journal_comptable (
        id SERIAL PRIMARY KEY,
        date_operation DATE,
        libelle TEXT,
        compte_debit VARCHAR(50),
        compte_credit VARCHAR(50),
        montant NUMERIC,
        type_flux VARCHAR(50),
        cloture BOOLEAN DEFAULT FALSE
    );
`).catch(err => console.error("Erreur tables:", err));

// --- ROUTES AUTH & PAGES ---
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.cookie('auth', 'true', { maxAge: 86400000, httpOnly: false });
        res.redirect('/');
    } else {
        res.redirect('/login?erreur=1');
    }
});
app.get('/logout', (req, res) => { res.clearCookie('auth'); res.redirect('/login'); });

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/locataires', (req, res) => res.sendFile(path.join(__dirname, 'locataires.html')));
app.get('/biens', (req, res) => res.sendFile(path.join(__dirname, 'biens.html')));
app.get('/baux', (req, res) => res.sendFile(path.join(__dirname, 'baux.html')));
app.get('/paiements', (req, res) => res.sendFile(path.join(__dirname, 'paiements.html')));
app.get('/factures', (req, res) => res.sendFile(path.join(__dirname, 'factures.html')));
app.get('/comptabilite', (req, res) => res.sendFile(path.join(__dirname, 'comptabilite.html')));

// --- API STANDARD (Locataires, Biens, Baux, Paiements, Factures) ---
app.get('/api/locataires', async (req, res) => {
    try { const r = await pool.query('SELECT * FROM locataires ORDER BY id DESC'); res.json(r.rows); } catch (e) { res.status(500).send(e.message); }
});
app.post('/api/locataires', async (req, res) => {
    try {
        const { nom, prenom, email, telephone, date_naissance } = req.body;
        await pool.query('INSERT INTO locataires (nom, prenom, email, telephone, date_naissance) VALUES ($1, $2, $3, $4, $5)', [nom, prenom, email, telephone, date_naissance || null]);
        res.redirect('/locataires');
    } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/locataires/:id', async (req, res) => {
    try { await pool.query('DELETE FROM locataires WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/biens', async (req, res) => {
    try { const r = await pool.query('SELECT * FROM biens ORDER BY id DESC'); res.json(r.rows); } catch (e) { res.status(500).send(e.message); }
});
app.post('/api/biens', async (req, res) => {
    try {
        const { nom_bien, type, loyer, statut } = req.body;
        await pool.query('INSERT INTO biens (nom_bien, type, loyer, statut) VALUES ($1, $2, $3, $4)', [nom_bien, type, loyer, statut || 'Libre']);
        res.redirect('/biens');
    } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/biens/:id', async (req, res) => {
    try { await pool.query('DELETE FROM biens WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/baux', async (req, res) => {
    try {
        const r = await pool.query('SELECT baux.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien FROM baux JOIN locataires ON baux.locataire_id = locataires.id JOIN biens ON baux.bien_id = biens.id ORDER BY baux.id DESC;');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});
app.post('/api/baux', async (req, res) => {
    try {
        let { locataire_id, bien_id, date_debut, date_fin, contrat_url } = req.body;
        await pool.query('INSERT INTO baux (locataire_id, bien_id, date_debut, date_fin, contrat_url) VALUES ($1, $2, $3, $4, $5)', [locataire_id, bien_id, date_debut || null, date_fin || null, contrat_url || null]);
        await pool.query("UPDATE biens SET statut = 'Loué' WHERE id = $1", [bien_id]);
        res.redirect('/baux');
    } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/baux/:id', async (req, res) => {
    try {
        const b = await pool.query('SELECT bien_id FROM baux WHERE id = $1', [req.params.id]);
        if (b.rows.length > 0) await pool.query("UPDATE biens SET statut = 'Libre' WHERE id = $1", [b.rows[0].bien_id]);
        await pool.query('DELETE FROM baux WHERE id = $1', [req.params.id]);
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/paiements', async (req, res) => {
    try {
        const r = await pool.query('SELECT paiements.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien FROM paiements JOIN locataires ON paiements.locataire_id = locataires.id JOIN biens ON paiements.bien_id = biens.id ORDER BY paiements.id DESC;');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});
app.post('/api/paiements', async (req, res) => {
    try {
        let { locataire_id, bien_id, date_paiement, montant, statut } = req.body;
        await pool.query('INSERT INTO paiements (locataire_id, bien_id, date_paiement, montant, statut) VALUES ($1, $2, $3, $4, $5)', [locataire_id, bien_id, date_paiement || null, montant, statut || 'Payé']);
        if ((statut || 'Payé') === 'Payé') {
            await pool.query("INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) VALUES ($1, $2, '531 - Caisse', '706 - Location de biens', $3, 'Encaissement')", [date_paiement || null, `Paiement loyer Locataire ID ${locataire_id}`, montant]);
            await pool.query("INSERT INTO caisse (date_operation, libelle, type_mouvement, montant) VALUES ($1, $2, 'Entree', $3)", [date_paiement || null, `Encaissement loyer ID ${locataire_id}`, montant]);
        }
        res.redirect('/paiements');
    } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/paiements/:id', async (req, res) => {
    try { await pool.query('DELETE FROM paiements WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/factures', async (req, res) => {
    try {
        const r = await pool.query('SELECT factures.*, locataires.nom as locataire_nom, locataires.prenom as locataire_prenom, biens.nom_bien FROM factures JOIN locataires ON factures.locataire_id = locataires.id JOIN biens ON factures.bien_id = biens.id ORDER BY factures.id DESC;');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});
app.post('/api/factures', async (req, res) => {
    try {
        let { type, locataire_id, bien_id, montant, date_emission, statut } = req.body;
        await pool.query('INSERT INTO factures (type, locataire_id, bien_id, montant, date_emission, statut) VALUES ($1, $2, $3, $4, $5, $6)', [type, locataire_id, bien_id, montant, date_emission || null, statut || 'Impayée']);
        res.redirect('/factures');
    } catch (e) { res.status(500).send(e.message); }
});
app.delete('/api/factures/:id', async (req, res) => {
    try { await pool.query('DELETE FROM factures WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e.message); }
});

// --- API COMPTABILITÉ AVANCÉE & CAISSE ---
app.get('/api/caisse', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM caisse ORDER BY date_operation DESC, id DESC');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});
app.post('/api/caisse', async (req, res) => {
    try {
        let { date_operation, libelle, type_mouvement, montant } = req.body;
        await pool.query('INSERT INTO caisse (date_operation, libelle, type_mouvement, montant) VALUES ($1, $2, $3, $4)', [date_operation || null, libelle, type_mouvement, montant]);
        // Reflète l'opération dans le journal général
        let debit = type_mouvement === 'Entree' ? '531 - Caisse' : '601 - Charges diverses';
        let credit = type_mouvement === 'Entree' ? '706 - Produits divers' : '531 - Caisse';
        await pool.query("INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) VALUES ($1, $2, $3, $4, $5, $6)", [date_operation || null, libelle, debit, credit, montant, type_mouvement === 'Entree' ? 'Encaissement' : 'Décaissement']);
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/comptabilite/journal', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM journal_comptable ORDER BY date_operation DESC, id DESC');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/comptabilite/ecriture', async (req, res) => {
    try {
        let { date_operation, libelle, compte_debit, compte_credit, montant, type_flux } = req.body;
        await pool.query('INSERT INTO journal_comptable (date_operation, libelle, compte_debit, compte_credit, montant, type_flux) VALUES ($1, $2, $3, $4, $5, $6)', [date_operation || null, libelle, compte_debit, compte_credit, montant, type_flux]);
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e.message); }
});

// Grand Livre (Regroupé par numéro de compte)
app.get('/api/comptabilite/grand-livre', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM journal_comptable ORDER BY compte_debit ASC, date_operation DESC');
        res.json(r.rows);
    } catch (e) { res.status(500).send(e.message); }
});

// Balance Générale
app.get('/api/comptabilite/balance', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM journal_comptable');
        let balanceMap = {};
        r.rows.forEach(e => {
            let m = parseFloat(e.montant);
            let dCompte = e.compte_debit;
            let cCompte = e.compte_credit;

            if(!balanceMap[dCompte]) balanceMap[dCompte] = { debit: 0, credit: 0 };
            if(!balanceMap[cCompte]) balanceMap[cCompte] = { debit: 0, credit: 0 };

            balanceMap[dCompte].debit += m;
            balanceMap[cCompte].credit += m;
        });
        res.json(balanceMap);
    } catch (e) { res.status(500).send(e.message); }
});

// Compte de Résultat
app.get('/api/comptabilite/resultat', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM journal_comptable');
        let produits = 0;
        let charges = 0;
        r.rows.forEach(e => {
            let m = parseFloat(e.montant);
            if (e.compte_credit && e.compte_credit.startsWith('7')) produits += m;
            if (e.compte_debit && e.compte_debit.startsWith('6')) charges += m;
        });
        res.json({ produits, charges, net: produits - charges });
    } catch (e) { res.status(500).send(e.message); }
});

// Clôture comptable
app.post('/api/comptabilite/cloture', async (req, res) => {
    try {
        await pool.query('UPDATE journal_comptable SET cloture = TRUE WHERE cloture = FALSE');
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(port, () => console.log(`Serveur actif sur le port ${port}`));
