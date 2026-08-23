// --- API : MODIFIER UN LOCATAIRE ---
app.delete('/api/locataires/:id', async (req, res) => {
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

// --- API : SUPPRIMER UN LOCATAIRE ---
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
