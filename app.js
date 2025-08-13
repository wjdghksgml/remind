const express = require("express");
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

// Firebase Admin SDK 초기화
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "remind-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// 메인 페이지 (로그인 필요)
app.get("/", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("index", { currentUser: req.session.user, posts: [] });
});

// 회원가입 페이지
app.get("/register", (req, res) => {
  res.render("register");
});

// 회원가입 처리
app.post("/register", async (req, res) => {
  const { id, password, nickname, organization } = req.body;
  if (!id || !password || !nickname) {
    return res.send("<script>alert('필수 항목을 모두 입력하세요.');history.back();</script>");
  }

  // 아이디 중복 체크
  const userRef = db.collection("users").doc(id);
  const docSnap = await userRef.get();
  if (docSnap.exists) {
    return res.send("<script>alert('이미 존재하는 아이디입니다.');history.back();</script>");
  }

  // Firestore에 저장
  await userRef.set({
    id,
    password, // 실제 환경에서는 bcrypt로 암호화 권장
    nickname,
    organization: organization || "",
    createdAt: new Date(),
  });

  console.log("📌 새 회원 가입:", { id, nickname, organization });

  res.redirect("/login");
});

// 로그인 페이지
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// 로그인 처리
app.post("/login", async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) {
    return res.render("login", { error: "아이디와 비밀번호를 모두 입력하세요." });
  }

  const userRef = db.collection("users").doc(id);
  const docSnap = await userRef.get();

  if (!docSnap.exists || docSnap.data().password !== password) {
    return res.render("login", { error: "아이디 또는 비밀번호가 잘못되었습니다." });
  }

  req.session.user = docSnap.data();
  res.redirect("/");
});

// 로그아웃
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
