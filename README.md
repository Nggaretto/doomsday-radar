# 🚨 Doomsday Watch — بوت حجز Avengers: Doomsday (جلاكسي طنطا)

بوت بيراقب موقع سينما جلاكسي طنطا، وأول ما الحجز يفتح:
1. يرنّلك على الموبايل بإنذار عالي (وإشعار بيتكرر لحد ما تدوس «تمام شفت»).
2. يختارلك **أحسن ٣ أماكن جنب بعض** (نص القاعة، ورا النص شوية، من غير ما يسيب كرسي لوحده).
3. تدوس «احجزلي الأماكن دي» وهو يحجزهم ويقف عند صفحة الدفع.

## المكونات
- `public/` — تطبيق الموبايل (PWA) بيتنصب على Firebase Hosting ويتثبت على الموبايل بأيقونة.
- `checker/` — البوت نفسه (Node.js) بيفحص الموقع ويبعت الإشعارات.
- `firestore.rules` / `firebase.json` — إعدادات Firebase.

## الخطوات (مرة واحدة)

### 1) مشروع Firebase (مجاني – خطة Spark)
1. ادخل https://console.firebase.google.com واعمل مشروع جديد.
2. من **Build → Firestore Database** اعمل Database (Production mode).
3. من **Project settings → General** اعمل **Web app** وانسخ الـ config وحطه في `public/firebase-config.js`.
4. من **Project settings → Cloud Messaging → Web Push certificates** دوس *Generate key pair* وانسخ المفتاح في `VAPID_KEY` في نفس الملف.
5. من **Project settings → Service accounts → Generate new private key** نزّل الملف وسمّيه `serviceAccountKey.json` وحطه جوه فولدر `checker/`. (**سرّي — متبعتوش لحد**)
6. غيّر `PASTE_YOUR_PROJECT_ID` في `.firebaserc` بالـ Project ID.

### 2) انشر التطبيق (في VS Code Terminal)
```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting,firestore:rules
```
هيدّيك لينك زي `https://اسم-مشروعك.web.app`.

### 3) ثبّت التطبيق على الموبايل
- **أندرويد (Chrome):** افتح اللينك → دوس «📲 ثبّت التطبيق» (أو القايمة ⋮ → Add to Home screen).
- **آيفون:** Safari → مشاركة ⬆️ → Add to Home Screen (لازم iOS 16.4+)، وافتحه من الأيقونة.
- افتح التطبيق ودوس **🔔 فعّل الإشعارات** واسمح بالإذن، وبعدين **🔊 جرّب صوت الإنذار**.

### 4) شغّل البوت
```bash
cd checker
npm install
cp .env.example .env     # وعدّل اللي محتاجه (بيانات حسابك للحجز الأوتوماتيك)
npm run test-push        # لازم يجيلك إشعار تجريبي على الموبايل
npm start
```
سيب الأمر شغال (على لابتوب/PC/سيرفر). شريط الحالة فوق في التطبيق بيبقى أخضر «البوت شغال».

> **تشغيل ٢٤ ساعة ببلاش:** Firebase Cloud Functions المجدولة محتاجة خطة Blaze (كارت). البدائل المجانية: تشغّل `npm start` على أي جهاز صاحي، أو تستخدم GitHub Actions (بيشتغل كل ٥ دقايق كحد أدنى بعدين لازم تغيّر `--once`).

## ⚠️ مهم تعرفه بصراحة
- **الحجز لسه مفتحش** وقت كتابة الكود، فمقدرتش أشوف صفحة اختيار الكراسي الحقيقية. القراءة عامة (Generic) واتجربت على صفحات تجريبية بس. أول ما الحجز يفتح:
  ```bash
  cd checker
  npm run debug
  ```
  هيحفظ صفحات الموقع في `checker/debug/`. ابعتهالي (أو ابعت لينك صفحة اختيار الكراسي) وأظبطلك السلكتورز في دقايق. ممكن كمان تضبطها من `.env` (`SEAT_SELECTOR`، `UNAVAILABLE_REGEX`، `REVERSE_ROWS`).
- لو الموقع بيحمّل المحتوى بجافاسكريبت (البوت مش شايف حاجة): `USE_BROWSER=true` ثم `npm i playwright && npx playwright install chromium`.
- **الدفع بإيدك:** البوت بيختار الكراسي ويكمل لحد صفحة الدفع. الكراسي غالباً بتتحجز مؤقتاً (دقايق) لحد ما تدفع، فكمّل بسرعة. الحجز الأوتوماتيك محتاج Playwright وبيانات حسابك في `.env`.
- **الصوت العالي:** الإشعار بيتحكم فيه الموبايل. على أندرويد: الإعدادات → التطبيقات → Chrome (أو التطبيق) → الإشعارات → خليها *Urgent/High* مع صوت، وقفل «عدم الإزعاج» للتطبيق ده. وكمان لما تفتح التطبيق بيرنّ سارينة بصوت عالي بنفسه (دوس «سيب الشاشة صاحية» لو هتسيبه مفتوح). الآيفون أضعف في الإشعارات المطولة.
- أي حد معاه لينك التطبيق يقدر يبعت طلب حجز؛ خلي اللينك سري.

## أوامر مفيدة
| الأمر | بيعمل إيه |
|---|---|
| `npm start` | تشغيل البوت بشكل مستمر |
| `npm run once` | فحص مرة واحدة |
| `npm run debug` | فحص مرة + حفظ الصفحات للتشخيص |
| `npm run test-push` | إشعار تجريبي |
| `npm run test-seats` | اختبار خوارزمية اختيار الكراسي |
