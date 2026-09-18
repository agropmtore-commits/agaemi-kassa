# İstəyə bağlı bəndlər — sənin tərəfdən hazırlıq tələb edənlər

Bu iki bənd kodla deyil, **kənar hesab / alət** ilə bloklanıb. Aşağıdakı addımları sən etdikdən sonra
növbəti sessiyada "DEVAM" — kod tərəfi 1 sessiyada bitir.

---

## A. Android APK (Capacitor)

**Lazımdırmı?** PWA onsuz da ana ekranda tətbiq kimi işləyir, offline-dır, qısayolları var.
APK yalnız bu hallarda lazımdır: (1) Agaemi "Play Store-dan olsun" desə, (2) Chrome-da "Ana ekrana
əlavə et" işləməsə, (3) kamera/paylaşma PWA-da problem versə. Real ehtiyac yaranmayıb.

**Sənin hazırlığın (bir dəfə, ~1 saat):**
1. **Android Studio** qur: https://developer.android.com/studio → quraşdırarkən "Android SDK" və
   "Android SDK Platform 34+" seçili qalsın.
2. **JDK 17** (Android Studio ilə gəlir — "Settings → Build Tools → Gradle → Gradle JDK" yoxla).
3. Mühit dəyişəni: `ANDROID_HOME` = `C:\Users\TORE\AppData\Local\Android\Sdk`
4. İmza açarı (release APK üçün, bir dəfə; **itirsən yeniləmə mümkün olmur**, backup et):
   ```bash
   keytool -genkeypair -v -keystore kassa-release.jks -alias kassa -keyalg RSA -keysize 2048 -validity 10000
   ```
   Faylı repo-dan kənarda saxla (məs. `C:\TORE WORKSPACE\keys\`), parolu qeyd et.

**Kod tərəfi (mən edəcəm):** `npm i @capacitor/core @capacitor/cli @capacitor/android`,
`npx cap init "Agaemi Kassa" az.agaemi.kassa --web-dir dist`, `npx cap add android`,
`vite.config.ts`-də `base: '/'` (APK-da alt qovluq yoxdur), `npm run build && npx cap sync`,
`android/` qovluğunda Gradle ilə `assembleRelease`, imza. Nəticə: `app-release.apk` → Agaeminin
telefonuna Telegram ilə → "Naməlum mənbələrə icazə" → quraşdır. Yeniləmələr: hər dəfə yeni APK
(PWA-dakı avtomatik yeniləmə itir — bu APK-nın əsas mənfi tərəfidir).

---

## B. Google Drive-a avtomatik ehtiyat nüsxə

**Lazımdırmı?** İndiki həll: həftəlik xatırlatma → "Paylaş" → Telegram "Saved Messages" / Drive.
Bir toxunuşdur. Avtomatik Drive yalnız Agaemi bunu da unudarsa lazımdır.

**Sənin hazırlığın (bir dəfə, ~20 dəq):**
1. https://console.cloud.google.com → yeni layihə: "Agaemi Kassa"
2. **APIs & Services → Library → Google Drive API → Enable**
3. **OAuth consent screen**: External → App name "Agaemi Kassa", sənin e-poçtun; Scopes: yalnız
   `https://www.googleapis.com/auth/drive.appdata` (tətbiqin öz gizli qovluğu — Agaeminin fayllarına
   toxunmur); **Test users**: Agaeminin Gmail-i (+ sənin). "Publish" lazım deyil — test rejimi kifayətdir.
4. **Credentials → Create → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://agropmtore-commits.github.io`
   - Redirect URI lazım deyil (token client istifadə olunur)
5. Alınan **Client ID**-ni (`....apps.googleusercontent.com`) mənə ver — gizli deyil, koda düşə bilər.

**Kod tərəfi (mən edəcəm):** Google Identity Services (`accounts.google.com/gsi/client`) token
client → `drive.appdata` scope → JSON backup-ı `appDataFolder`-ə yüklə (`files.create` /
`files.update`, `kassa-backup.json` tək fayl, üzərinə yazılır) → Ayarlarda "Drive-a qoşul" /
"Ayır" / "İndi göndər" + son göndərilmə vaxtı; hər açılışda son backup-dan N gün keçibsə fon
rejimində göndər. Bərpa: "Drive-dan geri yüklə" → həmin fayl → mövcud idxal axını.
Qeyd: token 1 saatlıqdır, GIS səssiz yeniləyir; internet yoxdursa növbəti açılışa qalır.

---

## C. Nə vaxt heç birini etməmək lazımdır

Agaemi 2–4 həftə istifadə etsin. Əgər (a) hər həftə backup xatırlatmasına əməl edirsə və
(b) PWA ikonu problemsiz açılırsa — bu iki bənd lazım deyil. Vaxtı real rəyə görə düzəlişlərə sərf et.
