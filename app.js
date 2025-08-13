const express = require("express");
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const bcrypt = require("bcrypt");

// ===== Firebase Admin SDK 초기화 =====
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ===== Express 기본 설정 =====
const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "remind-secret",          // 실제 서비스에서는 .env로 분리 권장
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

// ===== 로그인 필요 미들웨어 =====
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// ===== 라우팅 =====

// 루트: 로그인 안 했으면 /login 으로
app.get("/", requireAuth, async (req, res) => {
  // Firestore에서 포스트들 로드 (최신순)
  const snap = await db.collection("posts").orderBy("createdAt", "desc").get();
  const posts = snap.docs.map((d) => d.data());

  res.render("index", {
    currentUser: req.session.user, // { id, nickname, organization? }
    posts,
  });
});

// 회원가입 페이지
app.get("/register", (req, res) => {
  res.render("register");
});

// 회원가입 처리 (비밀번호 bcrypt 해시)
app.post("/register", async (req, res) => {
  try {
    const { id, password, nickname, organization } = req.body;

    // 필수값 검증
    if (!id || !password || !nickname) {
      return res.send("<script>alert('아이디/비밀번호/별명은 필수입니다.');history.back();</script>");
    }

    // 아이디 중복 체크
    const userRef = db.collection("users").doc(id);
    const doc = await userRef.get();
    if (doc.exists) {
      return res.send("<script>alert('이미 존재하는 아이디입니다.');history.back();</script>");
    }

    // 비밀번호 해시
    const saltRounds = 10;
    const hashed = await bcrypt.hash(password, saltRounds);

    // 저장
    const newUser = {
      id,
      passwordHash: hashed,    // ✅ 평문 대신 해시로 저장
      nickname,
      organization: organization || "",
      createdAt: new Date(),
    };
    await userRef.set(newUser);

    console.log("📌 새 회원 가입:", { id, nickname, organization: organization || "" });

    // 가입 후 로그인 페이지로
    return res.redirect("/login");
  } catch (err) {
    console.error("회원가입 오류:", err);
    return res.status(500).send("<script>alert('회원가입 중 오류가 발생했습니다.');history.back();</script>");
  }
});

// 로그인 페이지
app.get("/login", (req, res) => {
  // 에러 메시지 렌더링 지원
  res.render("login", { error: null });
});

// 로그인 처리 (bcrypt.compare)
app.post("/login", async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.render("login", { error: "아이디와 비밀번호를 모두 입력하세요." });
    }

    const userRef = db.collection("users").doc(id);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.render("login", { error: "아이디 또는 비밀번호가 잘못되었습니다." });
    }

    const user = doc.data();

    // 해시 검증
    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) {
      return res.render("login", { error: "아이디 또는 비밀번호가 잘못되었습니다." });
    }

    // 세션에 최소 정보만 저장
    req.session.user = {
      id: user.id,
      nickname: user.nickname,
      organization: user.organization || "",
    };

    return res.redirect("/");
  } catch (err) {
    console.error("로그인 오류:", err);
    return res.render("login", { error: "로그인 중 오류가 발생했습니다." });
  }
});

// 로그아웃
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// 포스트잇 추가 (로그인 필요)
app.post("/add", requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.send("<script>alert('내용을 입력하세요.');history.back();</script>");
    }

    const post = {
      content,
      nickname: req.session.user.nickname,
      userId: req.session.user.id,
      createdAt: new Date(),
    };

    await db.collection("posts").add(post);
    return res.redirect("/");
  } catch (err) {
    console.error("포스트 추가 오류:", err);
    return res.status(500).send("<script>alert('포스트 추가 중 오류가 발생했습니다.');history.back();</script>");
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
