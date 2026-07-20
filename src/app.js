require('dotenv').config();

const path = require('path');
const express = require('express');
const { connectDB } = require('./config/db');
const { t } = require('./lang');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basit sağlık kontrolü — Docker healthcheck ve manuel doğrulama için
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: t('common.appName') });
});

app.get('/', (req, res) => {
  res.render('index', { appName: t('common.appName') });
});

async function start() {
  try {
    await connectDB();
    console.log(t('system.dbConnected'));

    app.listen(PORT, () => {
      console.log(t('system.serverStarted', { port: PORT }));
    });
  } catch (err) {
    console.error(t('system.dbConnectionFailed'), '-', err.message);
    process.exit(1);
  }
}

start();
