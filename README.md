# Agaemi Kassa

Agaemi üçün şəxsi (ev) büdcə və kassa sistemi. Məqsəd — əlinə gələn hər pulu
**mədaxil**, xərclədiyi hər pulu **məxaric** kimi qeyd etmək və istənilən anda
pulun **haradan gəldiyini**, **hara getdiyini** və **nə qədər qaldığını** görmək.

> **Status:** **MVP hazırdır (v1.0.0)** — Mərhələ 1–4 tamamlandı. Canlı: https://agropmtore-commits.github.io/agaemi-kassa/ · Növbəti: Agaemi istifadəyə başlayır; Mərhələ 5 (şablonlar, PIN).
> Agaemi üçün sadə dildə xülasə: [AGAEMI_UCUN.md](AGAEMI_UCUN.md)

---

## 0. Qərar jurnalı

| # | Sual | Qərar | Səbəb |
|---|------|-------|-------|
| 1 | Cihaz | **Yalnız telefon (Android)** | Agaemi pul xərclənən anda telefondan qeyd edəcək |
| 2 | Məlumat harada | **Cihazın özündə** (IndexedDB) | Server yoxdur, internet lazım deyil, xərc sıfır |
| 3 | Tətbiq növü | **PWA** (ana ekrana quraşdırılan veb tətbiq) | Play Store / APK lazım deyil, yeniləmə avtomatik; lazım olsa sonra Capacitor ilə APK |
| 4 | Framework | **React + TypeScript** (Vite) | Standart, komponentlərə bölünür, genişlənir |
| 5 | Yaddaş qatı | **Dexie.js (IndexedDB)** | Limit yoxdur, indekslənmiş sorğu, transaction |
| 6 | Hosting | **GitHub Pages** (sənin hesabın) | Pulsuz HTTPS; Agaemiyə GitHub lazım deyil, yalnız link |
| 7 | MVP-yə daxil | **Başlanğıc balans, Nağd/kart ayrımı (cüzdanlar), Aylıq büdcə limiti** | Agaeminin tələbi |
| 8 | Köçürmə növü | **Bəli** — Kart ⇄ Nağd üçüncü əməliyyat növü | Bankomat pulu xərc kimi görünməsin |
| 9 | Kateqoriya strukturu | **Sadə siyahı** (bir səviyyə) | Sürətli əlavə, aydın statistika |
| 10 | Tam sistemə daxil | **Borc izləmə, Yığım hədəfi, Sürətli şablonlar** | Agaeminin tələbi |
| 11 | Rahatlıq / təhlükəsizlik | **PIN kilidi, Qaranlıq rejim, Excel/CSV ixrac, Qəbz şəkli** | Agaeminin tələbi |
| 12 | Kənarda qaldı | Təkrarlanan əməliyyatlar, bir neçə valyuta, alt-kateqoriyalar | İstənilmədi / sonra baxılar |
| 13 | Borc və ümumi qalıq | **Ümumi qalıq = real pul; alacaqlar ayrıca sətir** | Əldəki pul ilə vəd qarışmasın |
| 14 | Yığım panelde | **"Sərbəst" və "yığım" ayrı göstərilir** | Xərcləmək olan pul dərhal görünsün |
| 15 | PIN bərpası | **Bərpa sözü** (PIN qurularkən soruşulur) | Server yoxdur; məlumat itməsin |
| 16 | MVP-dən sonrakı sıra | **Şablon+Tema+PIN → Borc → Yığım → Qəbz+ZIP+Excel** | Tez dəyər verən, az riskli əvvəl |
| 17 | Statistika ayı | **Təqvim ayı** (1-dən sona) | Sadə, aydın |
| 18 | GitHub repo | **Public** | Pulsuz Pages; repo-da yalnız kod var |
| 19 | Ana ekran adı | **"Kassa"** (tam ad: Agaemi Kassa) | İkon altına sığır |
| 20 | İlk açılış | **Qısa qurulum sehrbazı** | Balanslar düzgün başlasın |
| 21 | Dizayn | **Yaşıl, sadə** — mədaxil yaşıl, məxaric qırmızı, ağ fon | Pul assosiasiyası, oxunaqlı |
| 22 | Agaemi üçün xülasə | **Bəli** — `AGAEMI_UCUN.md` | Planı onunla təsdiqləmək |
| 23 | Test cihazı | Kompüterdə Chrome telefon rejimi + sənin iPhone (Safari); Android-ə xas hissələr Agaeminin telefonunda | Sənin telefonun iPhone-dur |
| 24 | Məbləğ klaviaturası | **Öz böyük klaviaturamız** (0-9, vergül, sil) | Hər telefonda eyni, ","/"." problemi yoxdur |
| 25 | Əlavə etmə axını | **Məbləğ → "Növbəti" → kateqoriyaya toxun = yadda saxlanır**; 5 saniyə "Geri al" | Ən az toxunuş; cüzdan (sonuncu) və tarix (bu gün) avtomatik |
| 26 | Mənfi qalıq | **Cüzdan qalığı mənfi ola bilməz** — məxaric/köçürmə mövcud məbləğdən çox ola bilməz; forma "Mövcud · X ₼" göstərir və bloklayır. Mədaxil düzəlişi/silinməsi bloklanmır | Kartda 1 000 varsa 1 000-dən çox nağda keçməsin; səhv gəliri düzəltmək mümkün qalsın |
| 27 | Diaqram rəngləri | **Mədaxil yaşılı #059669, məxaric qırmızısı #dc2626** (CVD yoxlamasından keçir, ΔE 8,6); kateqoriya rəngləri dataviz istinad palitrasından; dairəvi diaqramda ≤ 6 dilim (qalanı "Qalan"), hər diaqramın cədvəl əkizi var | Rəng korluğunda da oxunsun; 13 kateqoriya eyni anda diaqrama sığmır |
| 28 | Arxiv qaydaları | **Cüzdan:** qalığı 0 deyilsə və ya sonuncu aktivdirsə arxivlənmir; **kateqoriya:** həmişə arxivlənir (köhnə əməliyyatlar qalır), sistem kateqoriyası yox | Pul "itməsin", tarixçə pozulmasın |
| 29 | Backup məzmunu | PIN və bərpa sözü **backup-a düşmür**; idxalda cihazın teması qorunur | Fayl Telegram/Drive-da gəzir |

## 1. Problem / Məqsəd

Agaemi öz pullarına nəzarət etmək istəyir:

- Pul gələndə → mədaxil kimi yazmaq (məbləğ + mənbə: maaş, əlavə iş, borc qaytarma və s.)
- Pul xərcləyəndə → məxaric kimi yazmaq (məbləğ + kateqoriya: ərzaq, kommunal, nəqliyyat və s.)
- Hər zaman görmək: **bu ay nə qədər gəlib, nə qədər gedib, hara nə qədər gedib**
- Ümumi statistika: aylar üzrə müqayisə, ən çox xərc çəkilən kateqoriyalar, qalıq (balans)

## 2. İstifadəçi

- **Tək istifadəçi** — Agaemi (ev büdcəsi, şirkət deyil)
- Texniki bilik tələb olunmamalıdır — 10 saniyəyə əməliyyat əlavə etmək mümkün olmalıdır
- Yalnız telefondan (Android, Chrome) istifadə ediləcək
- Dil: Azərbaycan dili, valyuta: AZN (₼)

### 2.1 Format qaydaları
| Nə | Necə | Nümunə |
|----|------|--------|
| Məbləğ göstərişi | minlik — boşluq, qəpik — vergül, sonda ₼ | `1 250,50 ₼` |
| Məbləğ daxil etmə | rəqəm klaviaturası; `.` və `,` hər ikisi qəbul olunur | `12.5` → `12,50 ₼` |
| Tarix | gün ay (il yalnız cari il deyilsə) | `15 sen`, `3 yan 2025` |
| Həftə başlanğıcı | Bazar ertəsi | |
| Ay | təqvim ayı, 1-dən sona | |
| Mənfi məbləğ | yoxdur — növ (mədaxil/məxaric) işarəni müəyyən edir | |

## 3. Əsas anlayışlar

### 3.1 Cüzdan (Nağd / Kart / Yığım)
Pulun fiziki olaraq harada olduğu. Hər cüzdanın öz qalığı var.
- Başlanğıcda: **Nağd**, **Kart** (istifadəçi əlavə edə bilər: ikinci kart, "ev seyfi" və s.)
- Hər cüzdana **başlanğıc balans** verilir ("hazırda nağdda 300, kartda 1 200 ₼ var")
- Cüzdan qalığı = başlanğıc + mədaxil − məxaric − çıxan köçürmə + gələn köçürmə ± borc hərəkətləri
- **Qalıq mənfi ola bilməz** (qərar #26): məxaric və köçürmə cüzdandakı mövcud məbləğlə məhdudlaşır
- **Yığım** tipli cüzdan — yığım hədəfləri üçün (bax 5.2)

### 3.2 Əməliyyat növləri
| Növ | Nə deməkdir | Cüzdan qalığı | Gəlir/xərc statistikası | Nümunə |
|-----|-------------|---------------|-------------------------|--------|
| **Mədaxil** | Pul kənardan gəldi | + | gəlir | Maaş karta gəldi |
| **Məxaric** | Pul kənara getdi | − | xərc | Marketdə 45 ₼ nağd |
| **Köçürmə** | Bir cüzdandan digərinə | −/+ | **düşmür** | Bankomatdan 200 ₼ (Kart → Nağd) |
| **Borc hərəkəti** | Borc verdim / aldım / qaytardım / qaytarıldı | −/+ | **düşmür** | Əliyə 100 ₼ borc verdim |

> Köçürmə və borc hərəkətləri statistikaya düşmür — əks halda bankomat pulu və ya
> qaytarılan borc "xərc/gəlir" kimi görünər və aylıq mənzərə yalan olar.

### 3.3 Mənbə və kateqoriya
- **Mənbə** — gəlirin haradan gəldiyi (Maaş, Əlavə iş, Hədiyyə, Satış…)
- **Kateqoriya** — xərcin hara getdiyi (Ərzaq, Kommunal, Nəqliyyat, Geyim, Səhiyyə…)
- Bir səviyyə (alt-kateqoriya yoxdur); istifadəçi əlavə edir / adını dəyişir / arxivləşdirir; rəng və ikon

**Təklif olunan default siyahı:**

| Xərc kateqoriyaları | Gəlir mənbələri |
|---------------------|-----------------|
| Ərzaq | Maaş |
| Kommunal (işıq, qaz, su, internet) | Əlavə iş |
| Nəqliyyat (yol, benzin, taksi) | Hədiyyə |
| Ev (kirayə, təmir, əşya) | Satış |
| Geyim | Digər |
| Səhiyyə (dərman, həkim) | |
| Təhsil | |
| Əyləncə / Kafe | |
| Telefon / Rabitə | |
| Uşaq / Ailə | |
| Kredit ödənişi | |
| Hədiyyə / Yardım | |
| Digər | |

### 3.4 Büdcə limiti
- Kateqoriya üzrə aylıq limit (məs. Ərzaq — 400 ₼)
- Ümumi aylıq xərc limiti (istəyə bağlı)
- Panel göstərir: limitin neçə %-i xərclənib (yaşıl < 70 % / sarı 70–100 % / qırmızı > 100 %)
- Limit keçəndə xəbərdarlıq — tətbiq daxilində banner (bax 7. Bildirişlər)

## 4. MVP funksiyaları

### 4.0 İlk açılış (onboarding) — bir dəfə
1. **Salam** — "Agaemi Kassa-ya xoş gəldin. Pulun harada olduğunu deyək." → Başla
2. **Cüzdanlar** — Nağd: `___ ₼`, Kart: `___ ₼` (başlanğıc balans; boş = 0). "+ Başqa cüzdan" mümkündür
3. **PIN** — "Tətbiqi PIN ilə qorumaq istəyirsən?" → Bəli (PIN + bərpa sözü) / İndi yox
4. **Panel** — hazırdır. Default kateqoriyalar artıq yaradılıb
- Hər addım sonra dəyişdirilə bilər (Daha çox → Cüzdanlar / Ayarlar)
- Sehrbaz yalnız məlumat bazası boş olanda göstərilir; backup idxal edilsə keçilir

### 4.1 Əməliyyat əlavə etmək (ən vacib ekran)
| Sahə | Mədaxil | Məxaric | Köçürmə |
|------|---------|---------|---------|
| Məbləğ (₼) | ✅ | ✅ | ✅ |
| Tarix (default bu gün) | ✅ | ✅ | ✅ |
| Cüzdan | hara gəldi | hardan getdi | hardan → hara |
| Mənbə / Kateqoriya | mənbə | kateqoriya | — |
| Qeyd | istəyə bağlı | istəyə bağlı | istəyə bağlı |

- Məbləğ üçün böyük rəqəm klaviaturası (telefonda rahat)
- Kateqoriya — ikonlu düymələr (siyahıdan seçmək yox, bir toxunuş)
- Cüzdan — sonuncu istifadə olunan default seçilir
- Yuxarıda şablon çipləri (bax 5.3)
- **Ana ekran qısayolu:** ikonu basılı saxlayanda "− Məxaric" / "+ Mədaxil" birbaşa açılır (PWA manifest shortcuts, Android Chrome dəstəkləyir)

> Sistemin uğuru bir şeydən asılıdır: Agaemi **hər** xərci yazmalıdır. Ona görə əlavə etmə
> 3 toxunuşdan çox olmamalıdır: qısayol → məbləğ → kateqoriya → hazır.

### 4.2 Əməliyyatlar siyahısı
- Tarix üzrə qruplaşdırılmış (Bu gün / Dünən / 15 sentyabr…), hər günün cəmi
- Filtr: ay, növ, cüzdan, kateqoriya
- Axtarış (qeyd üzrə)
- Redaktə və silmə — silinən əməliyyat üçün 5 saniyə "Geri al" düyməsi (təsdiq pəncərəsi əvəzinə, daha sürətli)

### 4.3 Panel (ana səhifə)
- Ümumi qalıq + hər cüzdanın qalığı (yığım ayrıca)
- Bu ay: mədaxil / məxaric / fərq
- Büdcə limitlərinin vəziyyəti
- Borclar xülasəsi (mənə borcludurlar / mən borcluyam)
- Son 5 əməliyyat
- Böyük düymələr: `+ Mədaxil` `− Məxaric` `⇄ Köçürmə`

### 4.4 Statistika
- Dövr seçimi: ay (istənilən keçmiş ay), il, xüsusi aralıq
- Kateqoriya üzrə xərc — dairəvi diaqram + cədvəl (məbləğ və %)
- Mənbə üzrə gəlir — eyni şəkildə
- Aylar üzrə gəlir/xərc — sütun diaqramı (son 12 ay)
- Bir kateqoriyanın aylar üzrə dəyişməsi (məs. "Ərzaq" trendi)
- Keçən ayla müqayisə (↑ ↓ %)
- Cüzdan üzrə xərc (nağddan nə qədər, kartdan nə qədər)
- Orta gündəlik xərc

### 4.5 Ayarlar
- Cüzdanlar (əlavə / redaktə / başlanğıc balans / arxiv)
- Kateqoriyalar və mənbələr
- Büdcə limitləri
- Backup (bax 6)
- Tema (açıq / qaranlıq / sistem)
- PIN

## 5. Tam sistem — MVP-dən sonrakı funksiyalar

### 5.1 Borc izləmə
```
Borc
  şəxs ("Əli"), istiqamət: verdim (mənə borcludur) | aldım (mən borcluyam)
  ilkin məbləğ, qalan məbləğ, tarix, son ödəniş tarixi (istəyə bağlı), qeyd, status: açıq | bağlı
```
Hərəkətlər (hamısı cüzdan qalığına təsir edir, **gəlir/xərc statistikasına düşmür**):

| Hərəkət | Cüzdan | Borc |
|---------|--------|------|
| Borc verdim | − | yaranır (mənə borcludur) |
| Qaytarıldı (tam / qismən) | + | azalır |
| Borc aldım | + | yaranır (mən borcluyam) |
| Qaytardım (tam / qismən) | − | azalır |
| Bağışladım / qaytarılmayacaq | — | qalan məbləğ xərcə çevrilir (kateqoriya: "Borc itkisi") |

- Ayrı ekran: açıq borclar siyahısı, şəxs üzrə, vaxtı keçənlər qırmızı
- Paneldə: "Mənə borcludurlar: 350 ₼ · Mən borcluyam: 0 ₼"
- Ümumi qalıq = yalnız real pul (alacaqlar daxil deyil); alacaqlar paneldə ayrıca sətirdə

### 5.2 Yığım hədəfi
```
Hədəf = Yığım tipli cüzdan + hədəf məbləği + son tarix (istəyə bağlı)
  "Telefon üçün" — 3 000 ₼ — mart 2027
```
- Yığıma pul qoymaq = adi cüzdandan yığım cüzdanına **köçürmə** (statistikaya düşmür, pul hələ Agaeminindir)
- Geri götürmək = əks köçürmə
- Proqres: `800 / 3 000 ₼ (27 %)` + "son tarixə çatmaq üçün ayda 367 ₼ lazımdır"
- Paneldə: "Ümumi 2 500 ₼ · ondan yığım 800 ₼ · **sərbəst 1 700 ₼**"

### 5.3 Sürətli əlavə şablonları
```
Şablon: ad, növ, məbləğ (istəyə bağlı), kateqoriya, cüzdan, qeyd
  [Çörək 1 ₼] [Yol 0.50 ₼] [Siqaret 4 ₼]
```
- Əlavə et ekranının yuxarısında çiplər; toxunuş → forma doldurulmuş açılır → "Yadda saxla"
- Məbləğ dəyişdirilə bilər (məs. bu dəfə çörək 1.20 oldu)
- Ayarlarda idarə edilir; ən çox istifadə olunanlar avtomatik önə çıxır

### 5.4 PIN kilidi
- 4 rəqəmli PIN; hash + salt ilə saxlanır (SHA-256, Web Crypto)
- Tətbiq açılanda və 5 dəqiqə arxa planda qalandan sonra soruşulur
- PIN qurularkən **bərpa sözü** soruşulur (hash ilə saxlanır) — unudulsa onunla yeni PIN qoyulur, məlumat itmir
- Dürüst qeyd: bu **ekran kilididir, şifrələmə deyil** — telefonu USB ilə kompüterə qoşub DevTools ilə məlumatı oxumaq mümkündür. Ev istifadəsi üçün yetərlidir; tam şifrələmə istənilsə ayrıca müzakirə (unudulan PIN = itən məlumat)

### 5.5 Qaranlıq rejim
- Sistem ayarına uyğun (default) + əl ilə seçim
- Bütün rənglər tema dəyişənləri ilə — diaqramlar da hər iki temada oxunaqlı

### 5.6 Excel / CSV ixrac
- `.xlsx` (SheetJS): vərəqlər — *Əməliyyatlar* (seçilmiş dövr), *Aylıq xülasə*, *Kateqoriya üzrə*
- `.csv` (UTF-8 BOM — Excel Azərbaycan hərflərini düzgün açsın)
- Fayl telefonun paylaşma menyusu ilə göndərilir (WhatsApp, Telegram, Drive…)

### 5.7 Qəbz şəkli
- Əməliyyata 1+ şəkil: kamera və ya qalereya
- Cihazda sıxılır: max 1 200 px, JPEG ≈ 100–200 KB → IndexedDB-də Blob kimi
- Siyahıda kiçik ikon, əməliyyat ekranında önizləmə, toxunanda tam ekran
- Backup-a təsiri: bax 6

## 6. Backup strategiyası (ən böyük risk)

Məlumat yalnız telefondadır. Telefon itsə / sıfırlansa / tətbiq silinsə — məlumat gedir.

| Rejim | Məzmun | Ölçü | Nə vaxt |
|-------|--------|------|---------|
| **Yalnız məlumat** | JSON: əməliyyatlar, cüzdanlar, kateqoriyalar, büdcə, borc, hədəf, şablon | kiçik (KB) | həftəlik tövsiyə |
| **Tam** | ZIP: JSON + qəbz şəkilləri | böyük (MB) | ayda bir |

- İxrac → Android paylaşma menyusu → Telegram "Saved Messages" / Google Drive / WhatsApp
- İdxal → faylı seç → "əvəz et" və ya "birləşdir" (dublikatlar id ilə tanınır)
- Xatırlatma: son backup-dan N gün (default 7) keçibsə paneldə banner
- `navigator.storage.persist()` — Chrome-a "bu saytın məlumatını silmə" tələbi
- Gələcək (istəyə bağlı): Google Drive-a avtomatik backup (OAuth lazımdır)

## 7. Bildirişlər — dürüst məhdudiyyət

Server olmadan PWA **arxa planda** bildiriş göndərə bilmir. Büdcə xəbərdarlığı, backup
xatırlatması, borc vaxtı — hamısı tətbiq **açılanda** banner kimi göstərilir.
Real push bildiriş üçün server lazımdır — planda yoxdur.

## 8. Məlumat modeli

```
Wallet (Cüzdan)
  id, name, type: "cash" | "card" | "savings"
  initial_balance, color, icon, sort_order, is_archived
  -- yalnız savings:
  target_amount, deadline

Category (Kateqoriya / Mənbə)
  id, type: "income" | "expense"
  name, color, icon, sort_order, is_archived, is_system   (məs. "Borc itkisi")

Transaction (Əməliyyat)
  id, type: "income" | "expense" | "transfer" | "debt"
  amount            — qəpiklə tam ədəd (12.50 ₼ → 1250)
  date              — YYYY-MM-DD
  wallet_id         — income: hara; expense/transfer/debt: hardan
  to_wallet_id      — yalnız transfer
  category_id       — yalnız income/expense
  debt_id           — yalnız debt
  debt_direction    — yalnız debt: "out" (pul çıxdı) | "in" (pul gəldi)
  note
  created_at, updated_at

Debt (Borc)
  id, person, direction: "lent" (verdim) | "borrowed" (aldım)
  initial_amount, date, due_date, note, status: "open" | "closed" | "forgiven"
  -- qalan məbləğ hesablanır: initial − Σ(debt hərəkətləri)

Template (Şablon)
  id, name, type, amount, category_id, wallet_id, note, sort_order, use_count

Budget (Büdcə limiti)
  id, category_id (boş = ümumi), amount, is_active

Attachment (Qəbz şəkli)
  id, transaction_id, blob, mime, width, height, size, created_at

Settings
  currency: "AZN", theme: "system" | "light" | "dark"
  pin_hash, pin_salt, recovery_hash, lock_timeout_min
  last_backup_at, backup_reminder_days
```

- Məbləğlər **qəpiklə tam ədəd** kimi saxlanır (0.1 + 0.2 ≠ 0.3 problemi olmasın)
- Silinən kateqoriya/cüzdan əslində **arxivlənir** — köhnə əməliyyatlar pozulmasın
- Bütün id-lər UUID — backup birləşdirmədə toqquşma olmasın

## 9. Ekranlar (aşağı naviqasiya — 4 tab + əlavə)

| Ekran | Məzmun |
|-------|--------|
| **Panel** | qalıqlar, bu ay, büdcə, borc xülasəsi, son əməliyyatlar, 3 böyük düymə |
| **Əməliyyatlar** | siyahı, filtr, axtarış |
| **Statistika** | diaqramlar, dövr seçimi |
| **Daha çox** | Borclar · Hədəflər · Şablonlar · Cüzdanlar · Kateqoriyalar · Büdcə · Backup · Ayarlar |
| Əməliyyat əlavə / redaktə | tam ekran forma (şablon çipləri yuxarıda) |
| Borc detalı | hərəkətlər tarixçəsi, qismən ödəniş |
| Hədəf detalı | proqres, köçürmə tarixçəsi |
| PIN ekranı | tətbiq açılanda |

## 10. Texnologiya (qərarlaşıb)

| Qat | Seçim |
|-----|-------|
| Build | Vite |
| UI | React 19 + TypeScript |
| Stil | Tailwind CSS |
| Yaddaş | Dexie.js (IndexedDB) + `dexie-react-hooks` (canlı sorğular) |
| Diaqram | Recharts 3 (dataviz qaydaları: nazik işarələr, legenda, cədvəl əkizi, yoxlanmış rənglər) |
| PWA | vite-plugin-pwa (manifest + service worker, offline) |
| Routing | React Router |
| Excel | SheetJS (`xlsx`) |
| ZIP backup | JSZip |
| Şəkil sıxma | Canvas API (kitabxanasız) |
| Hash | Web Crypto API (SHA-256) |
| Hosting | GitHub Pages (GitHub Actions ilə avtomatik deploy) |

**Necə işləyir:** kod GitHub-a push olunur → Actions build edir → https://agropmtore-commits.github.io/agaemi-kassa/ yenilənir → Agaemi tətbiqi açanda yeni versiya yüklənir. Agaeminin məlumatı heç vaxt telefondan çıxmır.

## 11. Mərhələlər

- [x] **Mərhələ 0 — Plan** — 18 sentyabr 2026
- [x] **Mərhələ 1 — Skelet** — 18 sentyabr 2026: Vite + React + TS + Tailwind + PWA; Dexie sxemi; default cüzdanlar/kateqoriyalar; 4 tab; GitHub Pages — ilk link
- [x] **Mərhələ 2 — Əməliyyatlar** — 18 sentyabr 2026: onboarding (başlanğıc balans); mədaxil / məxaric / köçürmə formu; siyahı, filtr, axtarış, redaktə, silmə; cüzdan qalıqları
- [x] **Mərhələ 3 — Panel və statistika** — 18 sentyabr 2026: ana panel; diaqramlar, dövr seçimi, müqayisə
- [x] **Mərhələ 4 — Büdcə, ayarlar, backup** — 18 sentyabr 2026: limitlər və xəbərdarlıq; cüzdan/kateqoriya idarəetməsi; JSON ixrac/idxal + xatırlatma
- [x] ✅ **MVP hazır (v1.0.0, 18 sentyabr 2026)** — Agaemi istifadəyə başlayır, real rəy toplanır
- [ ] **Mərhələ 5 — Rahatlıq** ← *növbəti*: şablonlar, PIN (qaranlıq rejim artıq var — Ayarlar → Tema)
- [ ] **Mərhələ 6 — Borc izləmə**
- [ ] **Mərhələ 7 — Yığım hədəfi**
- [ ] **Mərhələ 8 — Qəbz şəkli, tam backup (ZIP), Excel/CSV ixrac**
- [ ] **Sonra (istəyə bağlı)**: Capacitor APK, Google Drive backup, təkrarlanan əməliyyatlar

## 12. Necə işləyəcəyik

**Hər mərhələ üçün eyni dövr:**
1. Mərhələnin əhatəsi README-dən götürülür, lazımsa dəqiqləşdirilir
2. Kod yazılır; hesablama məntiqi (qalıq, statistika, büdcə %) üçün **avtomatik testlər** (Vitest)
3. Sən yoxlayırsan: kompüterdə Chrome (DevTools → telefon rejimi) və iPhone-da Safari (GitHub Pages linki — PWA iOS-da da quraşdırılır). Android-ə xas hissələr (quraşdırma təklifi, ikon qısayolları, paylaşma menyusu) Agaeminin telefonunda yoxlanır
4. Düzəlişlər → mərhələ bağlanır → README-də ✅ → git commit
5. **Mərhələ 4-dən sonra** link Agaemiyə verilir; ondan sonrakı mərhələlər onun real istifadəsindən gələn rəylə formalaşır

**Yeniləmə:** Agaemi tətbiqi açanda yeni versiya varsa "Yeni versiya hazırdır — Yenilə" göstərilir; toxunanda yenilənir, məlumat toxunulmur.

**Məlumat bazası dəyişəndə:** Dexie versiya miqrasiyası — köhnə məlumat avtomatik yeni sxemə keçir, Agaemi heç nə etmir.

**Keyfiyyət minimumu (hər mərhələdə):**
- Silmə əməliyyatlarında "Geri al"; heç nə səssiz silinmir
- Bütün məbləğ hesablamaları qəpiklə tam ədəddə — üzən nöqtə yoxdur
- Offline açılır (service worker), ilk yükləmədən sonra internet lazım deyil
- Telefon ekranında (360 px en) hər şey sığır, üfüqi sürüşmə yoxdur

### 12.1 Dizayn prinsipləri

- **Rənglər:** əsas — yaşıl; mədaxil yaşıl, məxaric qırmızı, köçürmə boz-mavi, borc narıncı, yığım bənövşəyi; açıq tema ağ fon, qaranlıq tema tünd-boz
- **Məbləğlər ön planda** — böyük şrift, hər ekranda ilk baxışda "nə qədər"
- **Bir əllə istifadə** — əsas düymələr ekranın aşağı yarısında, aşağı naviqasiya
- **Az mətn, çox ikon** — kateqoriyalar ikonla tanınır
- **Boş vəziyyətlər** — "Hələ əməliyyat yoxdur — ilk xərcini əlavə et" kimi yönləndirici mesajlar
- Kitabxana: Tailwind + öz komponentlərimiz (UI kit yoxdur — yüngül qalsın)

## 13. Layihə strukturu (təklif)

```
agaemi-kassa/
  README.md                 ← bu plan
  index.html
  package.json
  vite.config.ts            ← PWA plugin, base: /agaemi-kassa/
  public/
    icons/                  ← PWA ikonları (192, 512, maskable)
  src/
    main.tsx
    App.tsx                 ← router, tema, PIN qapısı
    db/
      schema.ts             ← Dexie cədvəlləri və versiyalar
      seed.ts               ← default cüzdan / kateqoriyalar
      backup.ts             ← ixrac / idxal
    domain/                 ← təmiz hesablama məntiqi (test olunur)
      money.ts              ← qəpik ↔ ₼, format
      balance.ts            ← cüzdan qalıqları
      stats.ts              ← ay/kateqoriya/mənbə cəmləri, müqayisə
      budget.ts             ← limit %-i
      debt.ts, goal.ts
    features/
      onboarding/
      dashboard/
      transactions/         ← siyahı, forma, filtr
      stats/
      budgets/
      wallets/
      categories/
      templates/
      debts/
      goals/
      settings/             ← tema, PIN, backup
    components/             ← ümumi UI (düymə, çip, rəqəm klaviaturası, sheet)
    hooks/
    i18n/az.ts              ← bütün mətnlər bir yerdə
  tests/                    ← domain/ üçün Vitest
  .github/workflows/deploy.yml
```

## 14. İnkişaf (developer qeydləri)

```bash
npm install        # bir dəfə
npm run dev        # http://localhost:5173/agaemi-kassa/  (Chrome DevTools → telefon rejimi)
npm test           # Vitest — domain/ və db/ testləri
npm run build      # tsc + vite build → dist/  (404.html avtomatik yaranır — Pages SPA fallback)
npm run preview    # dist/-i lokal yoxla (service worker burada işləyir, dev-də yox)
npm run icons      # public/icons/*.png-ni SVG-dən yenidən yarat (sharp)
```

- `VITE_BASE` — deploy yolu, default `/agaemi-kassa/` (repo adı dəyişsə bunu dəyiş)
- Yeni ekran: `src/features/<ad>/` · yeni mətn: `src/i18n/az.ts` · hesablama: `src/domain/` (+ `tests/`)
- Sxem dəyişəndə `KassaDB`-də `this.version(N+1).stores({...})` əlavə olunur — köhnə versiyalar silinmir

## 15. Vəziyyət

**Plan v1 — tamamlandı (18 sentyabr 2026).** 23 qərar verildi (bölmə 0). Açıq sual qalmayıb.

- [ ] `AGAEMI_UCUN.md` Agaemiyə göstərilir, rəyi alınır (xüsusən kateqoriya siyahısı və şablon nümunələri)
- [x] Mərhələ 4 — büdcə, ayarlar, backup (18 sentyabr 2026): kateqoriya/ümumi aylıq limitlər (panel: yaşıl/sarı/qırmızı + banner), cüzdan və kateqoriya idarəetməsi (ad, ikon, rəng, arxiv qaydaları), JSON ixrac (paylaş/yüklə) və idxal (əvəz et/birləşdir), backup xatırlatması, tema, sıfırlama
- [x] Mərhələ 3 — statistika (18 sentyabr 2026): dövr (ay / il / aralıq), KPI + əvvəlki dövrlə müqayisə, kateqoriya/mənbə payı (halqa + sıralı cədvəl), kateqoriya trendi, son 12 ay, cüzdan üzrə xərc, orta gündəlik; paneldə keçən ayla müqayisə
- [x] Mərhələ 2 — əməliyyatlar (18 sentyabr 2026): onboarding, mədaxil/məxaric/köçürmə formu (2 addım), siyahı + filtr + axtarış, redaktə/silmə + "Geri al", real qalıqlar, paneldə "bu ay"
- [x] Mərhələ 1 — skelet canlıdır (18 sentyabr 2026)
  - Repo: https://github.com/agropmtore-commits/agaemi-kassa (public)
  - Link: https://agropmtore-commits.github.io/agaemi-kassa/
  - Yoxlanıb: panel + seed, 4 tab, hər iki tema, service worker, dərin link (404 fallback), konsol təmiz
