const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoClient } = require('mongodb');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'remind_secret_key',
    resave: false,
    saveUninitialized: false,
  })
);

// MongoDB 연결 URI
const uri = "YOUR_MONGODB_CONNECTION_STRING";

// MongoClient 생성
const client = new MongoClient(uri);

let usersCollection;

// 서버 시작 전에 MongoDB 연결
async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB connected");
    const db = client.db("remind_db"); // DB 이름
    usersCollection = db.collection("users"); // 컬렉션 이름
  } catch (err) {
    console.error(err);
  }
}
connectDB();

// 로그인 여부 체크 미들웨어
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// 로그인 페이지
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 회원가입 페이지
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// 회원가입 처리
app.post('/register', async (req, res) => {
  const { id, password, nickname, organization } = req.body;

  if (!id || !password || !nickname || !organization) {
    return res.render('register', { error: '모든 항목을 입력해주세요.' });
  }

  try {
    // 중복 아이디 체크
    const existingUser = await usersCollection.findOne({ id });
    if (existingUser) {
      return res.render('register', { error: '이미 존재하는 아이디입니다.' });
    }

    // 신규 유저 저장
    await usersCollection.insertOne({ id, password, nickname, organization });
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 로그인 처리
app.post('/login', async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.render('login', { error: '아이디와 비밀번호를 모두 입력해주세요.' });
  }

  try {
    const user = await usersCollection.findOne({ id, password });
    if (!user) {
      return res.render('login', { error: '아이디 또는 비밀번호가 틀렸습니다.' });
    }

    req.session.userId = user.id;
    res.redirect('/index');
  } catch (err) {
    console.error(err);
    res.render('login', { error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 메인 페이지
app.get('/index', requireLogin, async (req, res) => {
  try {
    const currentUser = await usersCollection.findOne({ id: req.session.userId });
    res.render('index', { currentUser });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// 로그아웃
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
