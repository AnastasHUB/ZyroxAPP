const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function getHtml(url) {
  console.log('[getHtml] URL:', url);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    delete navigator.webdriver;
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
  });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.mouse.move(100, 200);
  await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (3000 - 1000) + 1000)));
  const content = await page.content();
  console.log('[getHtml] HTML length:', content.length);
  await browser.close();
  return content;
}

app.get('/api/lookup', async (req, res) => {
  const num_tel = req.query.num_tel;
  console.log('[lookup] Recherche pour numéro:', num_tel);
  if (!num_tel) {
    console.log('[lookup] Erreur: num_tel requis');
    return res.status(400).json({ error: 'num_tel requis' });
  }
  try {
    const url = `https://www.pagesjaunes.fr/annuaireinverse/recherche?quoiqui=${num_tel}&univers=annuaireinverse&idOu=`;
    console.log('[lookup] URL:', url);
    const html = await getHtml(url);
    const $ = cheerio.load(html);
    const name = $('a.bi-denomination h3').first().text().trim();
    const address = $('div.bi-address.small a').first().contents().filter(function() {
      return this.type === 'text';
    }).text().trim();
    let surname = '', firstName = '';
    if (name) {
      const parts = name.split(' ');
      surname = parts[0] || '';
      firstName = parts.slice(1).join(' ') || '';
    }
    console.log('[lookup] Résultat:', { nom: surname, prenom: firstName, adresse: address });
    try {
      res.json({ nom: surname, prenom: firstName, adresse: address });
      console.log('[lookup] Réponse envoyée au client');
    } catch (err) {
      console.log('[lookup] Erreur lors de l\'envoi de la réponse:', err);
    }
  } catch (e) {
    console.log('[lookup] Erreur:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération', details: e.message });
  }
});

// Initialisation SQLite
const db = new sqlite3.Database('./contacts.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT,
    prenom TEXT,
    num_tel TEXT,
    adresse TEXT,
    contact_statut TEXT,
    reponse_statut TEXT,
    commentaire TEXT
  )`);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Status options
const contactStatus = ['En attente', 'GMS', 'Porte à porte', 'Téléphone'];
const responseStatus = ['En attente', 'Possibilité', 'Accepté', 'Refus', 'À recontacter'];

// List contacts
app.get('/', (req, res) => {
  const q = req.query.q ? req.query.q.trim().toLowerCase() : '';
  let sql = 'SELECT * FROM contacts';
  let params = [];
  let countSql = 'SELECT COUNT(*) AS total FROM contacts';
  if (q) {
    sql += ` WHERE 
      LOWER(nom) LIKE ? OR
      LOWER(prenom) LIKE ? OR
      LOWER(num_tel) LIKE ? OR
      LOWER(adresse) LIKE ? OR
      LOWER(contact_statut) LIKE ? OR
      LOWER(reponse_statut) LIKE ? OR
      LOWER(commentaire) LIKE ?`;
    params = Array(7).fill(`%${q}%`);
    countSql = 'SELECT COUNT(*) AS total FROM contacts WHERE ' +
      'LOWER(nom) LIKE ? OR LOWER(prenom) LIKE ? OR LOWER(num_tel) LIKE ? OR LOWER(adresse) LIKE ? OR LOWER(contact_statut) LIKE ? OR LOWER(reponse_statut) LIKE ? OR LOWER(commentaire) LIKE ?';
  }
  db.all(sql, params, (err, rows) => {
    db.get(countSql, params, (err2, countRow) => {
      res.render('index', { contacts: rows, q, totalContacts: countRow ? countRow.total : 0 });
    });
  });
});

// Add contact form
app.get('/add', (req, res) => {
  res.render('form', { contact: {}, contactStatus, responseStatus, action: '/add', method: 'POST' });
});

// Add contact
app.post('/add', (req, res) => {
  const { nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire } = req.body;
  db.get('SELECT * FROM contacts WHERE num_tel = ? OR adresse = ?', [num_tel, adresse], (err, duplicate) => {
    if (duplicate) {
      return res.render('form', {
        contact: {},
        contactStatus,
        responseStatus,
        action: '/add',
        method: 'POST',
        notif: `Ce contact existe déjà (numéro ou adresse). <a href=\"/edit/${duplicate.id}\">Modifier ?</a>`,
        duplicateContact: duplicate
      });
    }
    db.run('INSERT INTO contacts (nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire],
      function(err) {
        res.redirect('/');
      }
    );
  });
});

// Edit contact form
app.get('/edit/:id', (req, res) => {
  db.get('SELECT * FROM contacts WHERE id = ?', [req.params.id], (err, contact) => {
    if (!contact) return res.redirect('/');
    res.render('form', { contact, contactStatus, responseStatus, action: `/edit/${contact.id}`, method: 'POST' });
  });
});

// Edit contact
app.post('/edit/:id', (req, res) => {
  const { nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire } = req.body;
  db.run('UPDATE contacts SET nom = ?, prenom = ?, num_tel = ?, adresse = ?, contact_statut = ?, reponse_statut = ?, commentaire = ? WHERE id = ?',
    [nom, prenom, num_tel, adresse, contact_statut, reponse_statut, commentaire, req.params.id],
    function(err) {
      res.redirect('/');
    }
  );
});

// Delete contact
app.post('/delete/:id', (req, res) => {
  db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], function(err) {
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
