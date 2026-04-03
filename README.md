# Humanoid Robot Economy + AI Income (Bilingual)

Bu proje, Türkçe ve İngilizce iki dilli statik web sitesi için hızla çalışan bir temel sağlar.

## Dosyalar
- `index.html` : Sayfa içeriği ve dil switcher
- `style.css` : Basit responsive görünüm
- `script.js` : Dil seçimi

## Lokal olarak çalıştırma
1. Terminali aç (`cd "~/Desktop/HUMANOID ROBOTS ECONOMY"`)
2. Basit bir sunucu çalıştır:
   - Python 3: `python3 -m http.server 8000`
   - Node (http-server): `npx http-server -p 8000`
3. `http://localhost:8000` adresinde aç.

## Ücretsiz deploy (önerilen)
- GitHub Pages
- Netlify (drag&drop ya da repo bağla)

### GitHub Pages örnek
1. Repo oluştur.
2. Dosyaları commit/push.
3. Settings > Pages > Branch `main` seç ve kaydet.
4. Site yayınlanana kadar bekle.

## Etkileşim
- `lang-btn` butonları ile diller arası geçiş yap.
- İçeriği genişlet: blog, kurs, danışmanlık, e-kitap.

## Notlar
- Dil secimi `localStorage` ile saklanir ve sayfalar arasi korunur.
