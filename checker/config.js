require('dotenv').config();

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);

module.exports = {
  // الموقع
  baseUrl: env('SITE_URL', 'https://tanta.galaxy-cinema.com/'),
  // أي لينك/نص فيه الكلمات دي يعتبر هو الفيلم
  movieRegex: new RegExp(env('MOVIE_REGEX', 'doomsday|دومز?داي|دوم ?سداي|يوم القيامة'), 'i'),
  // لينكات/أزرار الحجز في صفحة الفيلم
  bookingRegex: new RegExp(env('BOOKING_REGEX', 'book|حجز|احجز|ticket|تذاكر|تذكرة|showtime|session|seat|checkout|مواعيد|عروض'), 'i'),

  // كل كام ثانية يفحص
  pollSeconds: Number(env('POLL_SECONDS', 30)),
  // أقصى عدد عروض يحلل لهم خريطة المقاعد
  maxShows: Number(env('MAX_SHOWS', 8)),

  // الإنذار: يعيد الإشعار كل كام ثانية لحد ما تدوس "تمام شفت"
  repeatAlertSeconds: Number(env('REPEAT_ALERT_SECONDS', 90)),
  maxAlerts: Number(env('MAX_ALERTS', 15)),

  // عدد الكراسي وعدد الاقتراحات
  seatCount: Number(env('SEAT_COUNT', 3)),
  suggestions: Number(env('SUGGESTIONS', 3)),
  // أحسن صف كنسبة من عمق القاعة (0 = أول صف، 1 = آخر صف). 0.6 = ورا النص شوية
  idealRow: Number(env('IDEAL_ROW', 0.6)),

  // قراءة الصفحات
  useBrowser: env('USE_BROWSER', 'false') === 'true', // لو الموقع بيتحمل بجافاسكريبت
  debug: process.argv.includes('--debug') || env('DEBUG', 'false') === 'true',
  once: process.argv.includes('--once'),

  // سلكتورز خريطة المقاعد (عدّلها لو الموقع مختلف)
  seatSelector: env('SEAT_SELECTOR', '.seat, [data-seat], [data-seat-id]'),
  legendExclude: env('LEGEND_EXCLUDE', '[class*="legend"], [class*="screen"], [class*="key"], [class*="Legend"]'),
  unavailableRegex: new RegExp(
    env('UNAVAILABLE_REGEX', 'sold|taken|occupied|reserved|booked|unavailable|disabled|blocked|held|busy|محجوز|مباع|مشغول'),
    'i'
  ),
  // الصفوف مترتبة من الشاشة (الأمام) للخلف؟ لو الموقع عكس كده خليها true
  reverseRows: env('REVERSE_ROWS', 'false') === 'true',

  // الحجز الأوتوماتيك (Playwright)
  autoBook: env('AUTO_BOOK', 'true') === 'true',
  login: {
    url: env('LOGIN_URL', ''),
    user: env('LOGIN_USER', ''),
    pass: env('LOGIN_PASS', ''),
    userSelector: env('LOGIN_USER_SELECTOR', 'input[type="email"], input[name*="email" i], input[name*="user" i], input[type="tel"]'),
    passSelector: env('LOGIN_PASS_SELECTOR', 'input[type="password"]'),
    submitSelector: env('LOGIN_SUBMIT_SELECTOR', 'button[type="submit"], input[type="submit"]'),
  },
  continueSelector: env(
    'CONTINUE_SELECTOR',
    'button:has-text("Continue"), button:has-text("Book"), button:has-text("Confirm"), button:has-text("متابعة"), button:has-text("تأكيد"), button:has-text("احجز"), a:has-text("Continue")'
  ),
};
