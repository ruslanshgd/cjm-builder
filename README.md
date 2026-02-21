# CJM Builder / Сборка CJM — Figma Plugin

**[RU](#ru)** | **[EN](#en)**

---

## RU

Figma-плагин: Excel / расшифровка интервью → Customer Journey Map.

### Установка

```bash
npm install
```

### Сборка

```bash
npm run build
```

Результат — папка `plugin/` с `manifest.json`, `code.js`, `ui.html`.

### Загрузка в Figma

1. Figma → Plugins → Development → Import plugin from manifest…
2. Выберите `manifest.json` из папки `plugin/`

### Разработка (автосборка)

```bash
npm run watch
```

---

## EN

Figma plugin: Excel / interview transcripts → Customer Journey Map.

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

Output — folder `plugin/` with `manifest.json`, `code.js`, `ui.html`.

### Load in Figma

1. Figma → Plugins → Development → Import plugin from manifest…
2. Select `manifest.json` from the `plugin/` folder

### Development (auto-rebuild)

```bash
npm run watch
```
