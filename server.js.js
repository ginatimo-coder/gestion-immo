app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/nouveau-locataire', (req, res) => {
    res.sendFile(path.join(__dirname, 'nouveau-locataire.html'));
});