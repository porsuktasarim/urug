require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { connectDB } = require('./config/db');
const { ensureSystemAttributes } = require('./config/seedSystemAttributes');
const { migratePersonSearchAndSlugKeys } = require('./config/migratePersonKeys');
const { migrateFamilyColors } = require('./config/migrateFamilyColors');
const { t } = require('./lang');
const familyGroupsRouter = require('./routes/familyGroups.routes');
const attributeDefinitionsRouter = require('./routes/attributeDefinitions.routes');
const personsRouter = require('./routes/persons.routes');
const relationshipsRouter = require('./routes/relationships.routes');
const personProfileRouter = require('./routes/personProfile.routes');
const authRouter = require('./routes/auth.routes');
const userManagementRouter = require('./routes/userManagement.routes');
const treeViewRouter = require('./routes/treeView.routes');

const app = express();
const PORT = process.env.PORT || 1207;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Oturum yönetimi — session verisi MongoDB'de saklanır (connect-mongo),
// bu sayede container yeniden başlasa bile oturumlar kaybolmaz.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'gelistirme-icin-guvensiz-varsayilan',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 gün
    },
  })
);

// Oturum bilgisini tüm EJS görünümlerine otomatik enjekte eder — her
// render() çağrısında elle geçirmeye gerek kalmaz (bkz. partials/header.ejs).
app.use((req, res, next) => {
  res.locals.currentUsername = req.session && req.session.username ? req.session.username : null;
  res.locals.isGlobalAdmin = !!(req.session && req.session.isGlobalAdmin);
  next();
});

// Basit sağlık kontrolü — Docker healthcheck ve manuel doğrulama için
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: t('common.appName') });
});

app.get('/', (req, res) => {
  res.render('index', { appName: t('common.appName'), t });
});

app.use('/', authRouter);
app.use('/aileler', familyGroupsRouter);
app.use('/admin/ozellikler', attributeDefinitionsRouter);
app.use('/admin/kullanicilar', userManagementRouter);
app.use('/kisiler', personsRouter);
app.use('/kisiler', relationshipsRouter);
app.use('/kisiler', treeViewRouter);

// ÖNEMLİ: Bu route en son mount edilmeli — /:familySlug/:personSlug deseni
// path segment sayısı bakımından diğer route'larla (ör. /aileler/new)
// çakışabilir. Sabit route'lar önce eşleştiği için sorun olmuyor, ama
// sıralama bozulursa çakışma oluşur.
app.use('/', personProfileRouter);

async function start() {
  try {
    await connectDB();
    console.log(t('system.dbConnected'));

    await ensureSystemAttributes();
    await migratePersonSearchAndSlugKeys();
    await migrateFamilyColors();

    app.listen(PORT, () => {
      console.log(t('system.serverStarted', { port: PORT }));
    });
  } catch (err) {
    console.error(t('system.dbConnectionFailed'), '-', err.message);
    process.exit(1);
  }
}

start();
